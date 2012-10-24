var binding = require(__dirname + '/build/Release/binding');
var z = new binding.Tokeniser();
var fs = require('fs');
//var data = fs.readFileSync('mytest.html').toString();

z.process("<html>", function(err, res) {
  console.log(res);
});
z.process("<html>", function(err, res) {
  console.log(res);
});
z.process("<html>", function(err, res) {
  console.log(res);
});
