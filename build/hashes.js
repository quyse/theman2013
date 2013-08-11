/* Файл поддержки хешей.
*/

var fs = require('fs');
var ice = require('ice');
var crypto = require('crypto');
var config = require('./config');
var base64 = require('../lib/base64');

/** вычислить имя файла с хешем
 * @param fileName имя файла
 * @param hash хеш
 * @returns имя файла с хешем
 */
var hashFileName = exports.hashFileName = config.hideFileNames ? function(fileName, hash) {
	var a = /^(.*\/)[^\/]*(\.[^\.\/]+)$/.exec(fileName);
	if (a)
		return a[1] + hash + a[2];
	a = /^.*(\.[^\.]+)$/.exec(fileName);
	if (a)
		return hash + a[1];
	return hash;
} : function(fileName, hash) {
	var a = /^(.*)(\.[^\.\/]+)$/.exec(fileName);
	if (a)
		return a[1] + '-' + hash + a[2];
	return fileName + '-' + hash;
};

/** строка для формирования regexp - отслеживать имена хешей
 */
exports.regexpHashFileName = (config.hideFileNames ? '' : '.*\\-') + '([a-zA-Z0-9\\-\\_]{22})\\.[^\\.]+';

/** кэш хешей файлов
 */
var fileHashes = {};
/** обратный кэш хешей файлов
 */
var invertFileHashes = {};

/** получить хеш файла
 * конечно, тут может быть ситуация гонки, когда два запроса на один файл будут выяснять хеш
 * но ничего страшного, оба поочерёдно запишут хеш в кэш, и всё
 */
var getFileHash = exports.getFileHash = function(fileName, callback) {
	if (fileName in fileHashes) {
		callback(fileHashes[fileName]);
		return;
	}
	fs.readFile(fileName + '.hash', function(err, hash) {
		if (err)
			throw err;
		invertFileHashes[hash] = fileName;
		fileHashes[fileName] = hash;
		callback(hash);
	});
};
/** получить имя файла по хешу
 * ищет только в кэше, конечно
 */
var getFileNameByHash = exports.getFileNameByHash = function(hash) {
	return invertFileHashes[hash] || null;
};

/** найти в данных строки вида <%file%>, и заменить их на хеши имён
 * @param data {String} содержимое файла для обработки
 * @param dir {String} каталог, в котором нужно искать файлы-хеши
 * @param file {Object} объект-файл
 * @param callback {Function} функция, вызываемая по завершении
 * @param depCallback [optional] {Function} function(file, hash), которая вызывается на каждом файле-зависимости
 */
/* Работает в два прохода. В первый проход определяется список файлов, и по ним проверяются зависимости.
 * Во второй проход выполняется собственно замена.
 */
var resolve = exports.resolve = function(data, dir, file, callback, depCallback) {
	//сформировать регулярку
	var re = /<%([^\%]+)%>/g;

	// первый проход
	// указать файлы, от которых зависим
	var a;
	while (a = re.exec(data))
		file.dep(dir + a[1] + '.hash');

	// подождём зависимости
	file.dep(function() {
		// второй проход
		// выполнить собственно замену

		//выходные данные
		var outputData = '';
		//сколько уже выведено в выходные данные
		var last = 0;

		//функция для выполнения шага преобразования
		var step = function() {
			//попробовать найти следующий тег
			var a = re.exec(data);
			//если не найден
			if (a == null) {
				//вывести последние данные и успокоиться
				outputData += data.substr(last);
				callback(outputData);
			} else {
				//иначе тег найден
				//записать все данные до тега
				outputData += data.substr(last, a.index - last);
				//получить хеш файла
				getFileHash(dir + a[1], function(hash) {
					//записать имя файла с хешем
					outputData += hashFileName(a[1], hash);
					//если нужно, сообщить о файле
					if (depCallback)
						depCallback(a[1], hash);
					//запомнить границу
					last = re.lastIndex;
					//следующий шаг
					step();
				});
			}
		};
		//первый шаг
		step();
	});
};

// правило для хеш-файлов
ice.rule(/^(.+)\.hash$/, function(a, file) {
	file.dep(a[1], function() {
		fs.readFile(a[1], function(err, data) {
			if (err)
				throw err;
			var hash = crypto.createHash('md5');
			hash.update(data);
			hash = hash.digest('base64');
			hash = base64.convertToUrl(hash);
			fs.writeFile(a[0], hash, 'utf8', function(err) {
				if (err)
					throw err;
				file.ok();
			});
		});
	});
});
