/* Скрипт конфигурирования компиляции.
 */

var ice = require('ice');
var mainConfig = require('../lib/config');

configuration = process.env.CONFIGURATION || 'development';

/** добавить завершающий /, если нет
 */
var ensureDir = exports.ensureDir = function(dir) {
	if (dir.length == 0 || dir[dir.length - 1] != '/')
		return dir + '/';
	return dir;
};

if (configuration == 'production') {
	exports.minimizeJs = true;
	exports.unifyJs = true;
	exports.compressCss = true;
	exports.hideFileNames = true;
} else {
	exports.minimizeJs = false;
	exports.unifyJs = false;
	exports.compressCss = false;
	exports.hideFileNames = false;
}

baseDir = ensureDir(mainConfig.dirs.base);
siteDir = ensureDir(process.env.SITE_DIR || (baseDir + 'site'));
intermediateDir = ensureDir(process.env.INTERMEDIATE_DIR || (baseDir + 'intermediate'));
publicHashedDir = ensureDir(mainConfig.dirs.publicHashed);
publicFreshedDir = ensureDir(mainConfig.dirs.publicFreshed);
publicTemplatesDir = ensureDir(mainConfig.dirs.publicTemplates);

escapedIntermediateDir = ice.utils.regexpEscape(intermediateDir);
escapedPublicHashedDir = ice.utils.regexpEscape(publicHashedDir);
escapedPublicFreshedDir = ice.utils.regexpEscape(publicFreshedDir);
escapedPublicTemplatesDir = ice.utils.regexpEscape(publicTemplatesDir);
