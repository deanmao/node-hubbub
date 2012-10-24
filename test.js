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

var z = new binding.Tokeniser();
var fs = require('fs');
var data = fs.readFileSync('mytest.html').toString();

// z.process(data, function(err, res) {
//   console.log(res);
// });
// z.process(data, function(err, res) {
//   console.log(res);
// });
// z.process("<html>", function(err, res) {
//   console.log(res);
// });
// z.process("<html>", function(err, res) {
//   console.log(res);
// });
// z.process("<html>", function(err, res) {
//   console.log(res);
// });
// z.process("<script>for(var i=0;i<n;i++);</script>", function(err, res) {
//   console.log(res);
// });
// z.process("<html>", function(err, res) {
//   console.log(res);
// });

fs.readFile('google.html', function(err, data) {
  z.process(data.toString(), function(err, res) {
    console.log(res);
  });
})