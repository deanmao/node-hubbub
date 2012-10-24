var binding = require(__dirname + '/build/Release/binding');
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