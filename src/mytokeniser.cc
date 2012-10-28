#define BUILDING_NODE_EXTENSION
#include <node.h>
#include <v8.h>
#include <list>
#include "mytokeniser.h"

#include <inttypes.h>
#include <stdio.h>

using namespace v8;
using namespace std;

#define jsstr(x) String::New(x)
#define jssym(x) String::NewSymbol(x)
#define setobj(x, key, value) x->Set(key, value)

static hubbub_error token_handler(const hubbub_token *token, void *pw);

static void *myrealloc(void *ptr, size_t len, void *pw)
{
  return realloc(ptr, len);
}

Persistent<Function> Tokeniser::constructor;

Tokeniser::Tokeniser() {
  uv_mutex_init(&mutex_);
  pthread_cond_init(&cond_, NULL);
  parserutils_inputstream_create("UTF-8", 0, NULL, myrealloc, this, &stream_);
  hubbub_tokeniser_create(stream_, myrealloc, this, &tok_);
  hubbub_tokeniser_optparams params;
  params.token_handler.handler = token_handler;
  params.token_handler.pw = this;
  hubbub_tokeniser_setopt(tok_, HUBBUB_TOKENISER_TOKEN_HANDLER, &params);
  sequence_ = 1;
  count_ = 0;
}
Tokeniser::~Tokeniser() {
  delete stream_;
  uv_mutex_destroy(&mutex_);
  pthread_cond_destroy(&cond_);
}

void Tokeniser::Initialize(Handle<Object> target) {
  Local<FunctionTemplate> tpl = FunctionTemplate::New(New);
  tpl->SetClassName(String::NewSymbol("Tokeniser"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->Set(String::NewSymbol("process"), FunctionTemplate::New(Process)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("finish"), FunctionTemplate::New(Finish)->GetFunction());

  constructor = Persistent<Function>::New(
      tpl->GetFunction());
  target->Set(String::NewSymbol("Tokeniser"), constructor);
}

Handle<Value> Tokeniser::New(const Arguments& args) {
  HandleScope scope;

  Tokeniser* w = new Tokeniser();
  w->Wrap(args.This());

  return args.This();
}

void AsyncWork(uv_work_t* req) {
  BWork* work = static_cast<BWork*>(req->data);
  Tokeniser *t = (Tokeniser *) work->tokeniser;
  t->doWork(work);
}

void setObjectProperties(Local<Object> obj, list<MyToken>::iterator token) {
  setobj(obj, jssym("name"), jsstr(token->name.c_str()));
  {
    Local<Object> attrObj = v8::Object::New();
    list<MyAttribute> attrs = token->attributes;
    list<MyAttribute>::iterator attr;
    if (attrs.size() > 0) {
      for(attr=attrs.begin(); attr != attrs.end(); ++attr) {
        setobj(attrObj, jsstr(attr->name.c_str()), jsstr(attr->value.c_str()));
      }
      setobj(obj, jssym("attributes"), attrObj);
    }
  }
}

void makeSuccessCallback(Local<Object> res, Persistent<Function> callback) {
  Local<Value> argv[2] = {
      Local<Value>::New(Null()),
      res
  };

  TryCatch try_catch;
  callback->Call(Context::GetCurrent()->Global(), 2, argv);
  if (try_catch.HasCaught()) {
      node::FatalException(try_catch);
  }
}

void AsyncAfter(uv_work_t* req) {
    HandleScope scope;
    BWork* work = static_cast<BWork*>(req->data);
    Local<Object> doneObj = v8::Object::New();
    setobj(doneObj, jssym("type"), jsstr("done"));

    if (work->error) {
        Local<Value> err = Exception::Error(String::New("error"));

        const unsigned argc = 1;
        Local<Value> argv[argc] = { err };

        TryCatch try_catch;
        work->callback->Call(Context::GetCurrent()->Global(), argc, argv);
        if (try_catch.HasCaught()) {
            node::FatalException(try_catch);
        }
    } else {
        // loop through all objects and call with each one
        list<MyToken> tokens = work->tokens;
        list<MyToken>::iterator token;
        for(token=tokens.begin(); token != tokens.end(); ++token) {
          Local<Object> obj = v8::Object::New();
          switch (token->type) {
            case HUBBUB_TOKEN_DOCTYPE:
              setobj(obj, jssym("type"), jsstr("doctype"));
              setObjectProperties(obj, token);
              break;

            case HUBBUB_TOKEN_START_TAG:
              setobj(obj, jssym("type"), jsstr("start"));
              setObjectProperties(obj, token);
              break;

            case HUBBUB_TOKEN_END_TAG:
              setobj(obj, jsstr("type"), jsstr("end"));
              setObjectProperties(obj, token);
              break;

            case HUBBUB_TOKEN_COMMENT:
              setobj(obj, jssym("type"), jsstr("comment"));
              setobj(obj, jssym("data"), jsstr(token->data.c_str()));
              break;

            case HUBBUB_TOKEN_CHARACTER:
              setobj(obj, jssym("type"), jsstr("character"));
              setobj(obj, jssym("data"), jsstr(token->data.c_str()));
              break;

            case HUBBUB_TOKEN_EOF:
              setobj(obj, jssym("type"), jsstr("eof"));
              break;
        }
        makeSuccessCallback(obj, work->callback);
      }
      makeSuccessCallback(doneObj, work->callback);
    }

    work->callback.Dispose();
    delete work;
}

Handle<Value> Tokeniser::Finish(const Arguments& args) {
  HandleScope scope;

  return scope.Close(Undefined());
}

Handle<Value> Tokeniser::Process(const Arguments& args) {
  HandleScope scope;

  if (!args[0]->IsString()) {
      return ThrowException(Exception::TypeError(
          String::New("First argument must be a javascript string")));
  }

  if (!args[1]->IsBoolean()) {
      return ThrowException(Exception::TypeError(
          String::New("Second argument must be a boolean (true = blocking, false = non-blocking)")));
  }


  if (!args[2]->IsFunction()) {
      return ThrowException(Exception::TypeError(
          String::New("Third argument must be a callback function")));
  }

  Local<Function> callback = Local<Function>::Cast(args[2]);

  BWork* work = new BWork();
  work->error = false;
  work->request.data = work;
  work->callback = Persistent<Function>::New(callback);

  Tokeniser* t = ObjectWrap::Unwrap<Tokeniser>(args.This());
  Local<String> s = args[0]->ToString();
  bool blocking = args[1]->ToBoolean()->IsTrue();
  String::AsciiValue astr(s);
  work->len = strlen(*astr);
  work->html = new char[work->len + 1];
  strcpy(work->html, *astr);
  work->tokeniser = t;
  work->sequence = t->incrementCount();

  if (blocking) {
    AsyncWork(&work->request);
    AsyncAfter(&work->request);
  } else {
    int status = uv_queue_work(uv_default_loop(), &work->request, AsyncWork, AsyncAfter);
    assert(status == 0);
  }

  return Undefined();
}

int Tokeniser::incrementCount() {
  return ++count_;
}

void Tokeniser::doWork(BWork *work) {
  bool match = false;
  while(!match) {
    pthread_mutex_lock(&mutex_);
    if (work->sequence == sequence_) {
      match = true;
      ++sequence_;
    } else {
      pthread_mutex_unlock(&mutex_);
      timespec interval;
      interval.tv_sec = 0;
      interval.tv_nsec = 10;
      pthread_cond_timedwait(&cond_, &mutex_, &interval);
    }
  }
  work_ = work;
  parserutils_inputstream_append(stream_, (const uint8_t *) work->html, work->len);
  hubbub_tokeniser_run(tok_);
  pthread_mutex_unlock(&mutex_);
  pthread_cond_broadcast(&cond_);
}

void Tokeniser::addToken(const hubbub_token *token) {
  MyToken *mytoken = new MyToken();
  mytoken->type = token->type;
  bool shouldAdd = TRUE;
  switch (token->type) {
    case HUBBUB_TOKEN_DOCTYPE:
      mytoken->name = string((char*) token->data.doctype.name.ptr, (int) token->data.doctype.name.len);
      if (!token->data.doctype.public_missing) {
        MyAttribute *myattr = new MyAttribute();
        myattr->name = string("public");
        myattr->value = string((char *) token->data.doctype.public_id.ptr, (int) token->data.doctype.public_id.len);
        mytoken->attributes.push_back(*myattr);
      }
      if (!token->data.doctype.system_missing) {
        MyAttribute *myattr = new MyAttribute();
        myattr->name = string("system");
        myattr->value = string((char *) token->data.doctype.system_id.ptr, (int) token->data.doctype.system_id.len);
        mytoken->attributes.push_back(*myattr);
      }
      break;

    case HUBBUB_TOKEN_START_TAG:
      mytoken->name = string((char*) token->data.tag.name.ptr, (int) token->data.tag.name.len);
      for (size_t i = 0; i < token->data.tag.n_attributes; i++) {
        MyAttribute *myattr = new MyAttribute();
        myattr->name = string((char *) token->data.tag.attributes[i].name.ptr, (int) token->data.tag.attributes[i].name.len);
        myattr->value = string((char *) token->data.tag.attributes[i].value.ptr, (int) token->data.tag.attributes[i].value.len);
        mytoken->attributes.push_back(*myattr);
      }
      // if start tag is a script, set content_model on tokeniser to be HUBBUB_CONTENT_MODEL_CDATA
      if (mytoken->name.compare(string("script")) == 0) {
        hubbub_tokeniser_optparams params;
        params.content_model.model = HUBBUB_CONTENT_MODEL_CDATA;
        hubbub_tokeniser_setopt(tok_, HUBBUB_TOKENISER_CONTENT_MODEL, &params);
      }
      break;

    case HUBBUB_TOKEN_END_TAG:
      mytoken->name = string((char*) token->data.tag.name.ptr, (int) token->data.tag.name.len);
      for (size_t i = 0; i < token->data.tag.n_attributes; i++) {
        MyAttribute *myattr = new MyAttribute();
        myattr->name = string((char *) token->data.tag.attributes[i].name.ptr, (int) token->data.tag.attributes[i].name.len);
        myattr->value = string((char *) token->data.tag.attributes[i].value.ptr, (int) token->data.tag.attributes[i].value.len);
        mytoken->attributes.push_back(*myattr);
      }
      break;

    case HUBBUB_TOKEN_COMMENT:
      mytoken->data = string((char*) token->data.comment.ptr, (int) token->data.comment.len);
      break;

    case HUBBUB_TOKEN_CHARACTER:
      mytoken->data = string((char*) token->data.character.ptr, (int) token->data.character.len);
      // check if the previous token was also a character, and if so, squash them together
      {
        MyToken *previous = &(work_->tokens.back());
        if (previous->type == HUBBUB_TOKEN_CHARACTER && ((int) token->data.character.len) < 1000 && previous->data.length() < 1000) {
          shouldAdd = false;
          previous->data.append(mytoken->data);
        }
      }
      break;

    case HUBBUB_TOKEN_EOF:
      break;
  }
  if (shouldAdd) {
    work_->tokens.push_back(*mytoken);
  }
}

hubbub_error token_handler(const hubbub_token *token, void *pw)
{
  Tokeniser *t = (Tokeniser *) pw;
  t->addToken(token);

  return HUBBUB_OK;
}
