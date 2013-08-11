/* Файл поддержки компиляции javascript.
*/

var uglify = require('uglify-js');

/** минимизировать скрипт
 * использует uglify-js для минимизации
 */
var minimize = exports.minimize = function(code) {
	return uglify.minify(code, {
		fromString: true
	}).code;
};

/** замкнуть скрипт немного, чтобы при объединении не было ваты
 */
var prepareToUnify = exports.prepareToUnify = function(code) {
	return '\n' + code + '\n;\n';
};

/** замкнуть скрипт в функцию, имитируя систему модулей node.js
*/
var makeModule = exports.makeModule = function(code, moduleName) {
	return '\nnewModule(\'' + moduleName + '\', function(module, exports) {\n' + code + '\n});\n';
};
