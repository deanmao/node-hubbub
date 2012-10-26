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
    z.process("<html", print);
    z.process("><body", print);
    z.process("><h1", print);
    z.process("><b", print);
    z.process("></body>", print);
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
    z.process(html.slice(0, len), print);
    z.process(html.slice(len, -1), print);
  });
}

function test1() {
  var z = new binding.Tokeniser();
  z.process("<h1>", function(err, res) {
    console.log(res);
  });
  z.process("<h1>", function(err, res) {
    console.log(res);
  });
}

loopTest();
// test1();
