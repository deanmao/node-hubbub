#ifndef TOKENISER_H
#define TOKENISER_H

#include <node.h>
#include <v8.h>
#include <string>
#include <cstring>
#include <iostream>
#include <cstdlib>
#include <list>
#include <uv.h>


#include <parserutils/input/inputstream.h>
#include <hubbub/hubbub.h>
#include <utils/utils.h>
#include <tokeniser/tokeniser.h>


struct MyAttribute {
  std::string ns;
  std::string name;
  std::string value;
};

struct MyToken {
  hubbub_token_type type;
  std::string name;
  std::string value;
  std::string data;
  std::list<MyAttribute> attributes;
};

struct BWork {
    uv_work_t request;
    v8::Persistent<v8::Function> callback;
    bool error;
    std::string error_message;
    char* html;
    size_t len;
    void *tokeniser;
};

class Tokeniser : public node::ObjectWrap {
 public:
  static void Initialize(v8::Handle<v8::Object> target);
  void doWork(BWork *work);
  void addToken(const hubbub_token *token);
  void clearTokens() {tokens_.clear();};
  void lock();
  void unlock();
  std::list< MyToken > getTokens() {return tokens_;};

 private:
  Tokeniser();
  ~Tokeniser();
  static v8::Persistent<v8::Function> constructor;
  static v8::Handle<v8::Value> New(const v8::Arguments& args);
  static v8::Handle<v8::Value> Process(const v8::Arguments& args);
  static v8::Handle<v8::Value> Finish(const v8::Arguments& args);

  static int argc_;
  static char** argv_;
  
  parserutils_inputstream *stream_;
	hubbub_tokeniser *tok_;
  std::list< MyToken > tokens_;
  uv_mutex_t mutex_;
};

#endif
