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
  if (this.handler.writeTag) {
    this.parseChunk(chunk, cb, true);
  } else {
    this.parseChunk(chunk, cb);
  }
};

Parser.prototype.write = function(el, obj) {
  if (this.handler.writeTag) {
    // htmlparser 1.x api
    if (obj) {
      var t = el.type
      if (t === 'tag') {
        el.raw = el.raw || el.name;
        el.data = el.raw;
        if (obj.attributes) {
          el.attribs = obj.attributes;
        }
        this.handler.writeTag(el);
      } else if (t === 'text') {
        el.raw = el.data;
        this.handler.writeText(el);
      } else if (t === 'comment') {
        el.raw = el.data;
        this.handler.writeComment(el);
      } else if (t === 'doctype') {
        el.raw = el.data;
        el.type = 'directive';
        el.name = '!DOCTYPE';
        this.handler.writeDirective(el);
      }
    }
  } else {
    // htmlparser 2.x api
    this.handler.write(el);
  }
};

Parser.prototype.parseChunk = function(chunk, cb, blocking) {
  if (chunk) {
    var self = this;
    this.tokeniser.process(chunk.toString(), (blocking || false), function(err, obj) {
      if (obj) {
        var el = {};
        var t = obj.type
        if (t === 'character') {
          el.type = 'text';
          el.data = obj.data;
          self.write(el, obj);
        } else if (t === 'start') {
          el.type = 'tag';
          el.name = obj.name;
          self.write(el, obj);
        } else if (t === 'end') {
          el.type = 'tag';
          el.name = '/' + obj.name;
          el.raw = '/' + obj.name;
          self.write(el, obj);
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
          self.write(el, obj);
        } else if (t === 'comment') {
          el.type = 'comment';
          el.data = obj.data;
          self.write(el, obj);
        } else if (t === 'done') {
          cb && cb();
          return;
        }
        if (obj.attributes && t !== 'doctype') {
          var attrs = obj.attributes;
          for(var key in attrs) {
            if (attrs.hasOwnProperty(key)) {
              var attr = {type: 'attr', name: key, data: attrs[key]};
              self.write(attr);
            }
          }
        }
      }
    });
  }
};

exports.Parser = Parser;


// ElementType from tautologistics/node-htmlparser 1.x
var ElementType = {
    Text: "text" //Plain text
  , Directive: "directive" //Special tag <!...>
  , Comment: "comment" //Special tag <!--...-->
  , Script: "script" //Special tag <script>...</script>
  , Style: "style" //Special tag <style>...</style>
  , Tag: "tag" //Any tag that isn't special
}

// DefaultHandler from tautologistics/node-htmlparser 1.x
function DefaultHandler (callback, options) {
  this.reset();
  this._options = options ? options : { };
  if (this._options.ignoreWhitespace == undefined)
    this._options.ignoreWhitespace = false; //Keep whitespace-only text nodes
  if (this._options.verbose == undefined)
    this._options.verbose = true; //Keep data property for tags and raw property for all
  if (this._options.enforceEmptyTags == undefined)
    this._options.enforceEmptyTags = true; //Don't allow children for HTML tags defined as empty in spec
  if ((typeof callback) == "function")
    this._callback = callback;
}

//**"Static"**//
//HTML Tags that shouldn't contain child nodes
DefaultHandler._emptyTags = {
    area: 1
  , base: 1
  , basefont: 1
  , br: 1
  , col: 1
  , frame: 1
  , hr: 1
  , img: 1
  , input: 1
  , isindex: 1
  , link: 1
  , meta: 1
  , param: 1
  , embed: 1
}
//Regex to detect whitespace only text nodes
DefaultHandler.reWhitespace = /^\s*$/;

//**Public**//
//Properties//
DefaultHandler.prototype.dom = null; //The hierarchical object containing the parsed HTML
//Methods//
//Resets the handler back to starting state
DefaultHandler.prototype.reset = function DefaultHandler$reset() {
  this.dom = [];
  this._done = false;
  this._tagStack = [];
  this._tagStack.last = function DefaultHandler$_tagStack$last () {
    return(this.length ? this[this.length - 1] : null);
  }
}
//Signals the handler that parsing is done
DefaultHandler.prototype.done = function DefaultHandler$done () {
  this._done = true;
  this.handleCallback(null);
}
DefaultHandler.prototype.writeTag = function DefaultHandler$writeTag (element) {
  this.handleElement(element);
}
DefaultHandler.prototype.writeText = function DefaultHandler$writeText (element) {
  if (this._options.ignoreWhitespace)
    if (DefaultHandler.reWhitespace.test(element.data))
      return;
  this.handleElement(element);
}
DefaultHandler.prototype.writeComment = function DefaultHandler$writeComment (element) {
  this.handleElement(element);
}
DefaultHandler.prototype.writeDirective = function DefaultHandler$writeDirective (element) {
  this.handleElement(element);
}
DefaultHandler.prototype.error = function DefaultHandler$error (error) {
  this.handleCallback(error);
}

//**Private**//
//Properties//
DefaultHandler.prototype._options = null; //Handler options for how to behave
DefaultHandler.prototype._callback = null; //Callback to respond to when parsing done
DefaultHandler.prototype._done = false; //Flag indicating whether handler has been notified of parsing completed
DefaultHandler.prototype._tagStack = null; //List of parents to the currently element being processed
//Methods//
DefaultHandler.prototype.handleCallback = function DefaultHandler$handleCallback (error) {
    if ((typeof this._callback) != "function")
      if (error)
        throw error;
      else
        return;
    this._callback(error, this.dom);
}

DefaultHandler.prototype.isEmptyTag = function(element) {
  var name = element.name.toLowerCase();
  if (name.charAt(0) == '/') {
    name = name.substring(1);
  }
  return this._options.enforceEmptyTags && !!DefaultHandler._emptyTags[name];
};

DefaultHandler.prototype.handleElement = function DefaultHandler$handleElement (element) {
  if (this._done)
    this.handleCallback(new Error("Writing to the handler after done() called is not allowed without a reset()"));
  if (!this._options.verbose) {
//      element.raw = null; //FIXME: Not clean
    //FIXME: Serious performance problem using delete
    delete element.raw;
    if (element.type == "tag" || element.type == "script" || element.type == "style")
      delete element.data;
  }
  if (!this._tagStack.last()) { //There are no parent elements
    //If the element can be a container, add it to the tag stack and the top level list
    if (element.type != ElementType.Text && element.type != ElementType.Comment && element.type != ElementType.Directive) {
      if (element.name.charAt(0) != "/") { //Ignore closing tags that obviously don't have an opening tag
        this.dom.push(element);
        if (!this.isEmptyTag(element)) { //Don't add tags to the tag stack that can't have children
          this._tagStack.push(element);
        }
      }
    }
    else //Otherwise just add to the top level list
      this.dom.push(element);
  }
  else { //There are parent elements
    //If the element can be a container, add it as a child of the element
    //on top of the tag stack and then add it to the tag stack
    if (element.type != ElementType.Text && element.type != ElementType.Comment && element.type != ElementType.Directive) {
      if (element.name.charAt(0) == "/") {
        //This is a closing tag, scan the tagStack to find the matching opening tag
        //and pop the stack up to the opening tag's parent
        var baseName = element.name.substring(1);
        if (!this.isEmptyTag(element)) {
          var pos = this._tagStack.length - 1;
          while (pos > -1 && this._tagStack[pos--].name != baseName) { }
          if (pos > -1 || this._tagStack[0].name == baseName)
            while (pos < this._tagStack.length - 1)
              this._tagStack.pop();
        }
      }
      else { //This is not a closing tag
        if (!this._tagStack.last().children)
          this._tagStack.last().children = [];
        this._tagStack.last().children.push(element);
        if (!this.isEmptyTag(element)) //Don't add tags to the tag stack that can't have children
          this._tagStack.push(element);
      }
    }
    else { //This is not a container element
      if (!this._tagStack.last().children)
        this._tagStack.last().children = [];
      this._tagStack.last().children.push(element);
    }
  }
}

exports.DefaultHandler = DefaultHandler;

exports.jsdomConfigure = function(jsdom) {
  var orig = jsdom.browserAugmentation;
  jsdom.browserAugmentation = function(level, options) {
    options.parser = exports;
    return orig(level, options);
  }
  return jsdom;
};

