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

Parser.prototype.reset = function() {
    this.handler.reset();
};

Parser.prototype.done = function() {
    this.handler.done();
};


Parser.prototype.parseComplete = function(chunk, cb, blocking) {
  if (this.handler.writeTag || blocking) {
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
        if (obj.selfclosing) {
          el.name = '/' + el.name;
          el.raw = '/' + el.raw;
          el.data = '/' + el.data;
          this.handler.writeTag(el);
        }
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
          if (obj.selfclosing) {
            el.raw = el.name + ' /'
            el.selfclosing = true;
          }
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

var Mode = {
    Text: 'text',
    Tag: 'tag',
    Attr: 'attr',
    CData: 'cdata',
    Comment: 'comment'
};



function HtmlBuilder (callback, options) {
    this.reset();
    this._options = options ? options : { };
    if (this._options.ignoreWhitespace === undefined) {
        this._options.ignoreWhitespace = false; //Keep whitespace-only text nodes
    }
    if (this._options.includeLocation === undefined) {
        this._options.includeLocation = false; //Include position of element (row, col) on nodes
    }
    if (this._options.verbose === undefined) {
        this._options.verbose = true; //Keep data property for tags and raw property for all
    }
    if (this._options.enforceEmptyTags === undefined) {
        this._options.enforceEmptyTags = true; //Don't allow children for HTML tags defined as empty in spec
    }
    if (this._options.caseSensitiveTags === undefined) {
        this._options.caseSensitiveTags = false; //Lowercase all tag names
    }
    if (this._options.caseSensitiveAttr === undefined) {
        this._options.caseSensitiveAttr = false; //Lowercase all attribute names
    }
    if ((typeof callback) == "function") {
        this._callback = callback;
    }
}

    //**"Static"**//
    //HTML Tags that shouldn't contain child nodes
    HtmlBuilder._emptyTags = {
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
        , '?xml': 1
    };
    //Regex to detect whitespace only text nodes
    HtmlBuilder.reWhitespace = /^\s*$/;

    //**Public**//
    //Properties//
    HtmlBuilder.prototype.dom = null; //The hierarchical object containing the parsed HTML
    //Methods//
    //Resets the builder back to starting state
    HtmlBuilder.prototype.reset = function HtmlBuilder$reset() {
        this.dom = [];
        // this._raw = [];
        this._done = false;
        this._tagStack = [];
        this._lastTag = null;
        this._tagStack.last = function HtmlBuilder$_tagStack$last () {
            return(this.length ? this[this.length - 1] : null);
        };
        this._line = 1;
        this._col = 1;
    };
    //Signals the builder that parsing is done
    HtmlBuilder.prototype.done = function HtmlBuilder$done () {
        this._done = true;
        this.handleCallback(null);
    };

    HtmlBuilder.prototype.error = function HtmlBuilder$error (error) {
        this.handleCallback(error);
    };

    HtmlBuilder.prototype.handleCallback = function HtmlBuilder$handleCallback (error) {
            if ((typeof this._callback) != "function") {
                if (error) {
                    throw error;
                } else {
                    return;
                }
            }
            this._callback(error, this.dom);
    };

    HtmlBuilder.prototype.isEmptyTag = function HtmlBuilder$isEmptyTag (element) {
        var name = element.name.toLowerCase();
        if (name.charAt(0) == '?') {
            return true;
        }
        if (name.charAt(0) == '/') {
            name = name.substring(1);
        }
        return this._options.enforceEmptyTags && !!HtmlBuilder._emptyTags[name];
    };

    HtmlBuilder.prototype._getLocation = function HtmlBuilder$_getLocation () {
        return { line: this._line, col: this._col };
    };

    // HtmlBuilder.reLineSplit = /(\r\n|\r|\n)/g;
    HtmlBuilder.prototype._updateLocation = function HtmlBuilder$_updateLocation (node) {
        var positionData = (node.type === Mode.Tag) ? node.raw : node.data;
        if (positionData === null) {
            return;
        }
        // var lines = positionData.split(HtmlBuilder.reLineSplit);
        var lines = positionData.split("\n");
        this._line += lines.length - 1;
        if (lines.length > 1) {
            this._col = 1;
        }
        this._col += lines[lines.length - 1].length;
        if (node.type === Mode.Tag) {
            this._col += 2;
        } else if (node.type === Mode.Comment) {
            this._col += 7;
        } else if (node.type === Mode.CData) {
            this._col += 12;
        }
    };

    HtmlBuilder.prototype._copyElement = function HtmlBuilder$_copyElement (element) {
        var newElement = { type: element.type };

        if (this._options.verbose && element['raw'] !== undefined) {
            newElement.raw = element.raw;
        }
        if (element['name'] !== undefined) {
            switch (element.type) {

                case Mode.Tag:
                    newElement.name = this._options.caseSensitiveTags ?
                        element.name
                        :
                        element.name.toLowerCase()
                        ;
                    break;

                case Mode.Attr:
                    newElement.name = this._options.caseSensitiveAttr ?
                        element.name
                        :
                        element.name.toLowerCase()
                        ;
                    break;

                default:
                    newElement.name = this._options.caseSensitiveTags ?
                        element.name
                        :
                        element.name.toLowerCase()
                        ;
                    break;

            }
        }
        if (element['data'] !== undefined) {
            newElement.data = element.data;
        }
        if (element.location) {
            newElement.location = { line: element.location.line, col: element.location.col };
        }

        return newElement;
    };

    HtmlBuilder.prototype.write = function HtmlBuilder$write (element) {
        // this._raw.push(element);
        if (this._done) {
            this.handleCallback(new Error("Writing to the builder after done() called is not allowed without a reset()"));
        }
        if (this._options.includeLocation) {
            if (element.type !== Mode.Attr) {
                element.location = this._getLocation();
                this._updateLocation(element);
            }
        }
        if (element.type === Mode.Text && this._options.ignoreWhitespace) {
            if (HtmlBuilder.reWhitespace.test(element.data)) {
                return;
            }
        }
        var parent;
        var node;
        if (!this._tagStack.last()) { //There are no parent elements
            //If the element can be a container, add it to the tag stack and the top level list
            if (element.type === Mode.Tag) {
                if (element.name.charAt(0) != "/") { //Ignore closing tags that obviously don't have an opening tag
                    node = this._copyElement(element);
                    this.dom.push(node);
                    if (!this.isEmptyTag(node)) { //Don't add tags to the tag stack that can't have children
                        this._tagStack.push(node);
                    }
                    this._lastTag = node;
                }
            } else if (element.type === Mode.Attr && this._lastTag) {
                if (!this._lastTag.attributes) {
                    this._lastTag.attributes = {};
                }
                this._lastTag.attributes[this._options.caseSensitiveAttr ? element.name : element.name.toLowerCase()] =
                    element.data;
            } else { //Otherwise just add to the top level list
                this.dom.push(this._copyElement(element));
            }
        } else { //There are parent elements
            //If the element can be a container, add it as a child of the element
            //on top of the tag stack and then add it to the tag stack
            if (element.type === Mode.Tag) {
                if (element.name.charAt(0) == "/") {
                    //This is a closing tag, scan the tagStack to find the matching opening tag
                    //and pop the stack up to the opening tag's parent
                    var baseName = this._options.caseSensitiveTags ?
                        element.name.substring(1)
                        :
                        element.name.substring(1).toLowerCase()
                        ;
                    if (!this.isEmptyTag(element)) {
                        var pos = this._tagStack.length - 1;
                        while (pos > -1 && this._tagStack[pos--].name != baseName) { }
                        if (pos > -1 || this._tagStack[0].name == baseName) {
                            while (pos < this._tagStack.length - 1) {
                                this._tagStack.pop();
                            }
                        }
                    }
                }
                else { //This is not a closing tag
                    parent = this._tagStack.last();
                    if (element.type === Mode.Attr) {
                        if (!parent.attributes) {
                            parent.attributes = {};
                        }
                        parent.attributes[this._options.caseSensitiveAttr ? element.name : element.name.toLowerCase()] =
                            element.data;
                    } else {
                        node = this._copyElement(element);
                        if (!parent.children) {
                            parent.children = [];
                        }
                        parent.children.push(node);
                        if (!this.isEmptyTag(node)) { //Don't add tags to the tag stack that can't have children
                            this._tagStack.push(node);
                        }
                        if (element.type === Mode.Tag) {
                            this._lastTag = node;
                        }
                    }
                }
            }
            else { //This is not a container element
                parent = this._tagStack.last();
                if (element.type === Mode.Attr) {
                    if (!parent.attributes) {
                        parent.attributes = {};
                    }
                    parent.attributes[this._options.caseSensitiveAttr ? element.name : element.name.toLowerCase()] =
                        element.data;
                } else {
                    if (!parent.children) {
                        parent.children = [];
                    }
                    parent.children.push(this._copyElement(element));
                }
            }
        }
    };


    //**Private**//
    //Properties//
    HtmlBuilder.prototype._options = null; //Builder options for how to behave
    HtmlBuilder.prototype._callback = null; //Callback to respond to when parsing done
    HtmlBuilder.prototype._done = false; //Flag indicating whether builder has been notified of parsing completed
    HtmlBuilder.prototype._tagStack = null; //List of parents to the currently element being processed
    //Methods//

exports.HtmlBuilder = HtmlBuilder;

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

