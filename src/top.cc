#define BUILDING_NODE_EXTENSION
#include <node.h>

#include "mytokeniser.h"

using namespace v8;

void Initialize(Handle<Object> target) {
  Tokeniser::Initialize(target);
}

NODE_MODULE(binding, Initialize)
