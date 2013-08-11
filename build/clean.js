/* Скрипт очистки проекта.
*/

var ice = require('ice');
var fs = require('fs');
require('./config');

var removedFiles = 0;
var waiter = new ice.WaitForAll();

var cleanDir = function(dir) {
	var done = waiter.wait();
	fs.readdir(dir, function(err, files) {
		if (err)
			throw err;
		for ( var i = 0; i < files.length; ++i)
			(function(file, done) {
				fs.unlink(file, function(err) {
					if (err)
						throw err;
					++removedFiles;
					done();
				});
			})(dir + files[i], waiter.wait());
		done();
	});
};

cleanDir(intermediateDir);
cleanDir(publicHashedDir);
cleanDir(publicFreshedDir);
cleanDir(publicTemplatesDir);

waiter.target(function() {
	console.log(removedFiles + ' file(s) removed');
});
