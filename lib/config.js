/* Файл, управляющий конфигурацией сервера. 
*/

/** Файл конфигурации.
 */
var config = null;
if (process.env.CONFIG)
	config = JSON.parse(require('fs').readFileSync(process.env.CONFIG, 'utf8'));

/** Вспомогательная функция для задания настройки.
 */
var setup = function(name, defaultValue) {
	exports[name] = (config && config[name]) || defaultValue;
};

/** Файл журнала.
 */
setup('logFile', null);

/** Порт HTTP-сервера.
 */
setup('httpPort', 80);

/** Порт HTTPS-сервера.
 */
setup('httpsPort', 443);

/** Объект со строками-каталогами.
 */
var dirs = exports.dirs = {};

/** Вспомогательная функция для задания настройки-каталога.
 */
var setupDir = function(name, defaultDir) {
	dirs[name] = (config && config.dirs && config.dirs[name]) || defaultDir;
};

/** Базовый каталог приложения.
 */
dirs.base = __dirname + '/..';

/** Каталог с ключами - секретной информацией, используемой веб-приложением.
 */
setupDir('keys', dirs.base + '/keys');

/** Корневой каталог для публикации сайта. Все файлы в нём так или иначе доступны напрямую.
 */
setupDir('public', dirs.base + '/public');

/** Каталог для публикации хешированных файлов. Файлы из него отдаются с бесконечным expires.
 */
setupDir('publicHashed', dirs.public + '/hashed');

/** Каталог для публикации нехешированных файлов. Файлы из него отдаются с запретом кеширования.
 */
setupDir('publicFreshed', dirs.public + '/freshed');

/** Каталог для файлов, которые используются в веб-приложении, но не отдаются напрямую.
 */
setupDir('publicTemplates', dirs.public + '/templates');

