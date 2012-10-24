var binding;
var fs = require('fs');
try {
  if (fs.realpathSync(__dirname + '/build')) {
    binding = require(__dirname + '/build/Release/binding');
  }
} catch (e) {
  var platform_full = process.platform+'-'+process.arch;
  binding = require(__dirname + '/precompiled/'+platform_full+'/binding');
}
if (binding === null) {
  throw new Error('Cannot find appropriate binary library');
}

function Parser(handler) {
  this.tokeniser = new binding.Tokeniser();
  this.handler = handler;
}

// this function needs to be rewritten so that it blocks until completion
Parser.prototype.parseComplete = function(chunk, cb) {
  this.parseChunk(chunk, cb);
};

Parser.prototype.parseChunk = function(chunk, cb) {
  if (chunk) {
    var self = this;
    this.tokeniser.process(chunk.toString(), function(err, obj) {
      if (obj) {
        var el = {};
        var t = obj.type
        if (t === 'character') {
          el.type = 'text';
          el.data = obj.data;
        } else if (t === 'start') {
          el.type = 'tag';
          el.name = obj.name;
        } else if (t === 'end') {
          el.type = 'tag';
          el.name = '/' + obj.name;
          el.raw = '/' + obj.name;
        } else if (t === 'doctype') {
          el.type = 'doctype';
          el.name = obj.name;
        } else if (t === 'comment') {
          el.type = 'comment';
          el.data = obj.data;
        } else if (t === 'eof') {
          self.handler.done();
          cb && cb();
          return;
        } else if (t === 'done') {
          cb && cb();
          return;
        }
        if (t !== 'eof' && t !== 'done') {
          self.handler.write(el);
        }
        if (obj.attributes) {
          var attrs = obj.attributes;
          for(var key in attrs) {
            if (attrs.hasOwnProperty(key)) {
              self.handler.write({type: 'attr', name: key, data: attrs[key]});
            }
          }
        }
      }
    });
  }
};

exports.Parser = Parser;
