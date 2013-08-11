/* Простой модуль для кодирования/декодирования между строками utf8 и base64/base64url.
 * Использует стандартный Buffer node.js.
*/

var encode = function(data) {
	return new Buffer(data, 'utf8').toString('base64');
};
exports.encode = encode;

var decode = function(data) {
	return new Buffer(data, 'base64').toString('utf8');
};
exports.decode = decode;

/** Превратить base64 в base64url.
 * http://en.wikipedia.org/wiki/Base64#URL_applications
 */
var convertToUrl = function(data) {
	// заменить символы
	data = data.replace(/\+/g, '-').replace(/\//g, '_');
	// убрать концевые =, если есть
	data = data.substr(0, data.indexOf('='));
	return data;
};
exports.convertToUrl = convertToUrl;

/** Превратить base64url в base64.
 */
var convertFromUrl = function(data) {
	// добавить padding
	var len = data.length % 4;
	if (len == 2)
		data += '==';
	else if (len == 3)
		data += '=';
	// заменить символы
	return data.replace(/\-/g, '+').replace(/\_/g, '/');
};
exports.convertFromUrl = convertFromUrl;

exports.encodeUrl = function(data) {
	return convertToUrl(encode(data));
};

exports.decodeUrl = function(data) {
	return decode(convertFromUrl(data));
};
