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
  this.async = true;
}

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
          self.handler.write(el);
        } else if (t === 'start') {
          el.type = 'tag';
          el.name = obj.name;
          self.handler.write(el);
        } else if (t === 'end') {
          el.type = 'tag';
          el.name = '/' + obj.name;
          el.raw = '/' + obj.name;
          self.handler.write(el);
        } else if (t === 'doctype') {
          el.type = 'doctype';
          el.data = '';
          if (obj.name) {
            el.data += ' ' + obj.name;
          }
          if (obj.attributes) {
            if (obj.attributes.public) {
              el.data += ' PUBLIC \"' + obj.attributes.public + '\"';
            }
            if (obj.attributes.system) {
              el.data += ' \"' + obj.attributes.system + '\"';
            }
          }
          self.handler.write(el);
        } else if (t === 'comment') {
          el.type = 'comment';
          el.data = obj.data;
          self.handler.write(el);
        } else if (t === 'done') {
          cb && cb();
          return;
        }
        if (obj.attributes && t !== 'doctype') {
          var attrs = obj.attributes;
          for(var key in attrs) {
            if (attrs.hasOwnProperty(key)) {
              var attr = {type: 'attr', name: key, data: attrs[key]};
              self.handler.write(attr);
            }
          }
        }
      }
    });
  }
};

exports.Parser = Parser;
