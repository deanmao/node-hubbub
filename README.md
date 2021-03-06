# node-hubbub

A forgiving HTML parser with a native backend based on the html parser
from the netsurf browser (http://www.netsurf-browser.org/).  It is fully
backwards compatible with both tautologistics/node-htmlparser 1.x and
2.x.

There were some types of html that the tautologistics parser was unable
to handle so I created this native addon that uses an actual web
browser's parser.  It can be operated in blocking or non-blocking mode.

Similar to tautologistics's parser, it can operate in chunked mode as
well.  There are currently a few known utf-8 conversion bugs, but
hopefully I'll get around to fixing these soon.

## Installing

```bash
$ npm install hubbub
```

## Using it with jsdom

You can use it with jsdom, overriding the default parser by invoking
node-hubbub's jsdom configuration function before requiring jsdom.
Here's a brief example:

```js
var jsdom = require('hubbub').jsdomConfigure(require("jsdom"));

jsdom.env({
  html: "http://news.ycombinator.com/",
  scripts: ["http://code.jquery.com/jquery.js"],
  done: function (errors, window) {
    var $ = window.$;
    console.log("HN Links");
    $("td.title:not(:last) a").each(function() {
      console.log(" -", $(this).text());
    });
  }
});
```

