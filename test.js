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

var z = new binding.Tokeniser();

z.process("<html", function(err, res) {
  console.log('nothing:', res);
});
z.process("><body", function(err, res) {
  console.log('html:', res);
});
z.process("><h1>", function(err, res) {
  console.log('body and h1:', res);
});

// z.process("<h1>", function(err, res) {
//   console.log(res);
// });
// z.process("<h1>", function(err, res) {
//   console.log(res);
// });
