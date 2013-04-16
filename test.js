var binding;
var fs = require('fs');
try {
  if (fs.realpathSync(__dirname + '/build')) {
    binding = require(__dirname + '/build/Release/binding');
  }
} catch (e) {
  // var platform_full = process.platform+'-'+process.arch;
  // binding = require(__dirname + '/precompiled/'+platform_full+'/binding');
}
if (binding === null) {
  throw new Error('Cannot find appropriate binary library');
}

// crazy test to ensure we don't get a deadlock scenario
function loopTest() {
  var mycount = 0;
  var numLoops = 50000;
  function print(err, res) {
    if (res.type === 'end') {
      mycount = mycount + 1;
    }
  }
  for (var i=0; i<numLoops; i++) {
    var z = new binding.Tokeniser();
    z.process("<html", false, print);
    z.process("><body", false, print);
    z.process("><h1", false, print);
    z.process("><b", false, print);
    z.process("></body>", false, print);
  }
  setInterval(function() {
    if (mycount == numLoops) {
      console.log("done");
      process.exit(0);
    } else {
      console.log("total: ", mycount);
    }
  }, 500);
}

function test2() {
  var z = new binding.Tokeniser();
  fs.readFile('mytest2.html', function(err, data) {
    var html = data.toString();
    var len = Math.floor(html.length / 2);
    z.process(html.slice(0, len), false, print);
    z.process(html.slice(len, -1), false, print);
  });
}

function testNonBlocking() {
  var z = new binding.Tokeniser();
  z.process("<h1>", false, function(err, res) {
    console.log(res);
  });
  z.process("<h1>", false, function(err, res) {
    console.log(res);
  });
}

function testBlocking() {
  var z = new binding.Tokeniser();
  z.process("<h1>", true, function(err, res) {
    console.log(res);
  });
  z.process("<h1>", true, function(err, res) {
    console.log(res);
  });
}

function testparser(useHtmlparser) {
  var parser;
  var count = 0;
  if (useHtmlparser) {
    parser = require('htmlparser');
  } else {
    parser = require('./index');
  }
  var handler = new parser.DefaultHandler();
  handler.orig = handler.writeTag;
  handler.writeTag = function(el) {
    count = count + 1;
    handler.orig(el);
  };
  var parserInstance = new parser.Parser(handler);
  fs.readFile('acid3.html', function(err, data) {
    parserInstance.parseComplete(data.toString());
    console.log(count, 'total html tags');
  });
}

function testparser2() {
  var parser = require('./index');
  var handler = new parser.DefaultHandler();
  var parserInstance = new parser.Parser(handler);
  fs.readFile('blah.html', function(err, data) {
    parserInstance.parseComplete(data.toString());
  });
}

function testutf8() {
  var z = new binding.Tokeniser();
  fs.readFile('utf.html', function(err, data) {
    z.process(data.toString(), false, function(err, res) {
      console.log(res);
    });
  });
}

// function stuff() {
//   console.log('');
//   var z = new binding.Tokeniser();
//   for(var i=1; i<8; i++) {
//     console.log(i);
//     var data = fs.readFileSync("stuff/html_1_chunk_"+i+".html");
//     z.process(data.toString(), function(err, res) {
//       if (res.type == 'done') {
//         console.log('x')
//       }
//     });
//   }
// }

//loopTest();
// testBlocking();
// testNonBlocking();
// testparser2();
testutf8();