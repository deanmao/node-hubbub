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
#define jsstr2(x, y) String::New(x, y)
#define setobj(x, key, value) obj->Set(key, value)

static hubbub_error token_handler(const hubbub_token *token, void *pw);

static void *myrealloc(void *ptr, size_t len, void *pw)
{
	return realloc(ptr, len);
}

Persistent<Function> Tokeniser::constructor;

Tokeniser::Tokeniser() {
  parserutils_inputstream_create("UTF-8", 0, NULL, myrealloc, this, &stream_);
	hubbub_tokeniser_create(stream_, myrealloc, this, &tok_);
  hubbub_tokeniser_optparams params;
  params.token_handler.handler = token_handler;
	params.token_handler.pw = this;
	hubbub_tokeniser_setopt(tok_, HUBBUB_TOKENISER_TOKEN_HANDLER, &params);
	uv_mutex_init(&mutex_);
}
Tokeniser::~Tokeniser() {
  delete stream_;
  delete tok_;
  uv_mutex_destroy(&mutex_);
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

void AsyncAfter(uv_work_t* req) {
    HandleScope scope;
    BWork* work = static_cast<BWork*>(req->data);
    
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
        ((Tokeniser*) work->tokeniser)->lock();
        list<MyToken> tokens = ((Tokeniser*) work->tokeniser)->getTokens();
        list<MyToken>::iterator token;
        for(token=tokens.begin(); token != tokens.end(); ++token) {
          Local<Object> obj = v8::Object::New();
          switch (token->type) {
            case HUBBUB_TOKEN_DOCTYPE:
              setobj(obj, jssym("type"), jsstr("doctype"));
              setobj(obj, jssym("name"), jsstr(token->name.c_str()));
              break;
        
            case HUBBUB_TOKEN_START_TAG:
              setobj(obj, jssym("type"), jsstr("start"));
              setobj(obj, jssym("name"), jsstr(token->name.c_str()));
              {
                Local<Object> attrObj = v8::Object::New();
                list<MyAttribute> attrs = token->attributes;
                list<MyAttribute>::iterator attr;
                for(attr=attrs.begin(); attr != attrs.end(); ++attr) {
                  setobj(attrObj, jsstr(attr->name.c_str()), jsstr(attr->value.c_str()));
                }
                setobj(obj, jssym("attributes"), attrObj);
              }
              break;
        
            case HUBBUB_TOKEN_END_TAG:
              setobj(obj, jsstr("type"), jsstr("end"));
              setobj(obj, jssym("name"), jsstr(token->name.c_str()));
              {
                Local<Object> attrObj = v8::Object::New();
                list<MyAttribute> attrs = token->attributes;
                list<MyAttribute>::iterator attr;
                for(attr=attrs.begin(); attr != attrs.end(); ++attr) {
                  setobj(attrObj, jsstr(attr->name.c_str()), jsstr(attr->value.c_str()));
                }
                setobj(obj, jssym("attributes"), attrObj);
              }
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
        const unsigned argc = 2;
        Local<Value> argv[argc] = {
            Local<Value>::New(Null()),
            obj
        };

        TryCatch try_catch;
        work->callback->Call(Context::GetCurrent()->Global(), argc, argv);
        if (try_catch.HasCaught()) {
            node::FatalException(try_catch);
        }
        
        ((Tokeniser*) work->tokeniser)->unlock();
      }
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
          String::New("Second argument must be a javascript string")));
  }

  if (!args[1]->IsFunction()) {
      return ThrowException(Exception::TypeError(
          String::New("Third argument must be a callback function")));
  }

  Local<Function> callback = Local<Function>::Cast(args[1]);
  
  BWork* work = new BWork();
  work->error = false;
  work->request.data = work;
  work->callback = Persistent<Function>::New(callback);

  Tokeniser* w = ObjectWrap::Unwrap<Tokeniser>(args.This());
  Local<String> s = args[0]->ToString();
  String::AsciiValue astr(s);
  work->len = strlen(*astr);
  work->html = new char[work->len + 1];
  strcpy(work->html, *astr);
  work->tokeniser = w;

  int status = uv_queue_work(uv_default_loop(), &work->request, AsyncWork, AsyncAfter);
  assert(status == 0);
  
  return Undefined();
}

void Tokeniser::lock() {
  uv_mutex_lock(&mutex_);
}

void Tokeniser::unlock() {
  uv_mutex_unlock(&mutex_);
}

void Tokeniser::doWork(BWork *work) {
  // convert work->html into buf & bytes_read
  lock();
  tokens_.clear();
  parserutils_inputstream_append(stream_, (const uint8_t *) work->html, work->len);
  hubbub_tokeniser_run(tok_);
  unlock();
}

void Tokeniser::addToken(const hubbub_token *token) {
  MyToken *mytoken = new MyToken();
  mytoken->type = token->type;
  switch (token->type) {
    case HUBBUB_TOKEN_DOCTYPE:
      mytoken->name = string((char*) token->data.doctype.name.ptr, (int) token->data.doctype.name.len);
      break;

    case HUBBUB_TOKEN_START_TAG:
      mytoken->name = string((char*) token->data.tag.name.ptr, (int) token->data.tag.name.len);
      for (size_t i = 0; i < token->data.tag.n_attributes; i++) {
        MyAttribute *myattr = new MyAttribute();
        myattr->name = string((char *) token->data.tag.attributes[i].name.ptr, (int) token->data.tag.attributes[i].name.len);
        myattr->value = string((char *) token->data.tag.attributes[i].value.ptr, (int) token->data.tag.attributes[i].value.len);
        mytoken->attributes.push_back(*myattr);
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
      break;
 
    case HUBBUB_TOKEN_EOF:
      break;
  }
  tokens_.push_back(*mytoken);
}

hubbub_error token_handler(const hubbub_token *token, void *pw)
{
	Tokeniser *t = (Tokeniser *) pw;
  t->addToken(token);

	return HUBBUB_OK;
}
