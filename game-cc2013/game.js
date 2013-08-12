(function(exports) {
    
    var canvas, engine, canvasWidth, canvasHeight;
    var programSky, programCloud, programSimple, programMorph;
    var meshSky, meshCloud, meshVDV, meshRocket;
    var textureCloud, textureRocket, textureBack, textureVdv;

    var particleTypes = {};

    var particles = [];
    var rockets = [];

exports.init = function(callback) {

    canvas = document.getElementById("canvas");
    engine = new window.engine.Engine(canvas);
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    
    exports.eyePosition = [0, 0, 0];
    exports.eyeDirection = [1, 0, 0];
    var lightAlpha = Math.PI * 0.4;
    var lightBeta = Math.PI * 0.7;
    exports.lightDirection = [Math.cos(lightAlpha) * Math.cos(lightBeta), Math.sin(lightAlpha) * Math.cos(lightBeta), Math.sin(lightBeta)];
    
    exports.vdvPosition = vec3.create();
    exports.screenSpeed = 1;
    
    // программа неба
	var vsSky = engine.loadVertexShader('\
attribute vec2 aPosition;\
varying vec4 vPosition;\
void main(void) {\
	vPosition = vec4(aPosition, 0.9999999, 1);\
	gl_Position = vPosition;\
}\
');
	var psSky = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
varying vec4 vPosition;\
uniform mat4 uInvViewProj;\
uniform vec3 uLightDirection;\
uniform vec3 uEyePosition;\
uniform vec3 uMapOffset;\
uniform vec2 uMapScale;\
uniform sampler2D uBackTexture;\
void main(void) {\
	vec4 p = uInvViewProj * vPosition;\
    p /= p.w;\
	float q = dot(normalize(p.xyz - uEyePosition), uLightDirection) * 0.5 + 0.5;\
    vec4 mapColor = texture2D(uBackTexture, (uEyePosition.xy - p.xy * uMapOffset.z / p.z + uMapOffset.xy) * uMapScale);\
	gl_FragColor = p.z > 0.0 ? vec4(q, q, 1, 1) : mapColor;\
}\
');
	programSky = engine.loadProgram(vsSky, psSky, ['aPosition'], [{
		name: 'uInvViewProj',
		type: 'mat4'
	}, {
		name: 'uEyePosition',
		type: 'vec3'
	}, {
		name: 'uLightDirection',
		type: 'vec3'
	}, {
        name: 'uMapOffset',
        type: 'vec3'
	}, {
        name: 'uMapScale',
        type: 'vec2'
	}, {
        name: 'uBackTexture',
        type: 'texture'
	}]);

    // программа облака
    var vsCloud = engine.loadVertexShader('\
attribute vec2 aPosition;\
attribute vec2 aTexcoord;\
uniform mat4 uWorldViewProj;\
uniform vec2 uSize;\
varying vec2 vTexcoord;\
void main(void) {\
	vec4 p = uWorldViewProj * vec4(0,0,0,1);\
	p.xy += aPosition * uSize;\
	gl_Position = p;\
	vTexcoord = aTexcoord;\
}\
');
	var psCloud = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
uniform sampler2D uCloudTexture;\
uniform vec4 uColor;\
varying vec2 vTexcoord;\
void main(void) {\
	gl_FragColor = texture2D(uCloudTexture, vTexcoord) * uColor;\
}\
');
	programCloud = engine.loadProgram(vsCloud, psCloud, ['aPosition', 'aTexcoord'], [{
		name: 'uWorldViewProj',
		type: 'mat4'
	}, {
		name: 'uSize',
		type: 'vec2'
	}, {
		name: 'uCloudTexture',
		type: 'texture'
	}, {
        name: 'uColor',
        type: 'vec4'
	}]);

    // программа обычных моделей
    var vsSimple = engine.loadVertexShader('\
attribute vec3 aPosition;\
attribute vec3 aNormal;\
attribute vec2 aTexcoord;\
uniform mat4 uWorld;\
uniform mat4 uWorldViewProj;\
varying vec4 vWorldPosition;\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
void main(void) {\
    vec4 position = vec4(aPosition, 1);\
    vWorldPosition = uWorld * position;\
    gl_Position = uWorldViewProj * position;\
    vNormal = mat3(uWorld) * aNormal;\
	vTexcoord = aTexcoord;\
}\
');
    var psSimple = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
varying vec4 vWorldPosition;\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
uniform vec3 uLightDirection;\
uniform vec3 uEyePosition;\
uniform sampler2D uColorTexture;\
void main(void) {\
    vec3 normal = normalize(vNormal);\
    vec3 reflectedLight = normal * dot(normal, uLightDirection) * 2.0 - uLightDirection;\
	vec3 color = \
		texture2D(uColorTexture, vTexcoord).xyz * (0.3 + max(0.0, dot(normal, uLightDirection))) +\
			+ vec3(1.0,1.0,1.0) * 5.0 * pow(max(0.0, dot(normalize(uEyePosition - vWorldPosition.xyz), reflectedLight)), 32.0);\
	gl_FragColor = vec4(color,1);\
}\
');
    programSimple = engine.loadProgram(vsSimple, psSimple, ['aPosition', 'aNormal', 'aTexcoord'], [{
    	name: 'uWorld',
		type: 'mat4'
	}, {
		name: 'uWorldViewProj',
		type: 'mat4'
	}, {
		name: 'uEyePosition',
		type: 'vec3'
    }, {
		name: 'uLightDirection',
		type: 'vec3'
	}, {
		name: 'uColorTexture',
		type: 'texture'
	}]);

    // программа морфируемых моделей
    var vsMorph = engine.loadVertexShader('\
attribute vec3 aPosition1;\
attribute vec3 aPosition2;\
attribute vec3 aNormal1;\
attribute vec3 aNormal2;\
attribute vec2 aTexcoord1;\
attribute vec2 aTexcoord2;\
uniform mat4 uWorld;\
uniform mat4 uWorldViewProj;\
uniform float uStep;\
varying vec4 vWorldPosition;\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
void main(void) {\
    vec4 position = vec4(mix(aPosition1, aPosition2, uStep), 1);\
    vWorldPosition = uWorld * position;\
	gl_Position = uWorldViewProj * position;\
    vNormal = mat3(uWorld) * mix(aNormal1, aNormal2, uStep);\
	vTexcoord = mix(aTexcoord1, aTexcoord2, uStep);\
}\
');
    programMorph = engine.loadProgram(vsMorph, psSimple, ['aPosition1', 'aPosition2', 'aNormal1', 'aNormal2', 'aTexcoord1', 'aTexcoord2'], [{
		name: 'uWorld',
		type: 'mat4'
	}, {
		name: 'uWorldViewProj',
		type: 'mat4'
	}, {
		name: 'uEyePosition',
		type: 'vec3'
	}, {
        name: 'uStep',
        type: 'float'
    }, {
		name: 'uLightDirection',
		type: 'vec3'
	}, {
		name: 'uColorTexture',
		type: 'texture'
	}]);



    // создать меши
    var waiter = new primitives.WaitForAll();
    
    // меш неба
	var skyVerticesData = [ //
	-1, -1, //
	1, -1, //
	1, 1, //
	-1, 1,//
	];
	var skyIndicesData = [0, 1, 3, 1, 2, 3];
	meshSky = engine.loadMesh(1, skyVerticesData, skyIndicesData, [{
		name: 'aPosition',
		size: 2
	}]);
	// меш облака
	var cloudVerticesData = [ //
	-1, -1, 0, 1, //
	1, -1, 1, 1, //
	1, 1, 1, 0, //
	-1, 1, 0, 0, //
	];
	var cloudIndicesData = skyIndicesData;
	meshCloud = engine.loadMesh(1, cloudVerticesData, cloudIndicesData, [{
		name: 'aPosition',
		size: 2
	}, {
		name: 'aTexcoord',
		size: 2
	}]);
    
    (function(done) {
		engine.loadPackedMesh('tresh.mesh.png', [{
			name: 'aPosition',
			size: 3
		}, {
			name: 'aNormal',
			size: 3
		}, {
			name: 'aTexcoord',
			size: 2
		}], function(mesh) {
			meshVDV = mesh;
			done();
		});
	})(waiter.addWait());

    (function(done) {
    	engine.loadPackedMesh('rocket.mesh.png', [{
			name: 'aPosition',
			size: 3
		}, {
			name: 'aNormal',
			size: 3
		}, {
			name: 'aTexcoord',
			size: 2
		}], function(mesh) {
			meshRocket = mesh;
			done();
		});
	})(waiter.addWait());

    // текстура облака
    (function(done) {
		engine.loadTexture('cloud10.png', {
			alpha: true,
			linear: false
		}, function(texture) {
            particleTypes.cloud = texture;
			textureCloud = texture;
			done();
		});
	})(waiter.addWait());
    // текстура ракеты
    (function(done){
        engine.loadTexture('rocket.png', {
            alpha: false,
            linear: false
        }, function(texture) {
            textureRocket = texture;
            done();
        });
    })(waiter.addWait());
    // текстура задника
    (function(done){
        engine.loadTexture('back.png', {
            alpha: false,
            linear: false
        }, function(texture) {
            textureBack = texture;
            done();
        });
    })(waiter.addWait());
    // путин
    (function(done){
        engine.loadTexture('putin.png', {
            alpha: false,
            linear: false
        }, function(texture) {
            particleTypes.putin = texture;
            done();
        });
    })(waiter.addWait());
    // медведев
    (function(done){
        engine.loadTexture('medvedev.png', {
            alpha: false,
            linear: false
        }, function(texture) {
            particleTypes.medvedev = texture;
            done();
        });
    })(waiter.addWait());
    // огонь
    (function(done){
        engine.loadTexture('flame.png', {
            alpha: true,
            linear: false
        }, function(texture) {
            particleTypes.flame = texture;
            done();
        });
    })(waiter.addWait());
    // пуля
    (function(done){
        engine.loadTexture('bullet.png', {
            alpha: true,
            linear: false
        }, function(texture) {
            particleTypes.bullet = texture;
            done();
        });
    })(waiter.addWait());
    // вдв
    (function(done){
        engine.loadTexture('vdv.png', {
            alpha: false,
            linear: false
        }, function(texture) {
            textureVdv = texture;
            done();
        });
    })(waiter.addWait());
    
    waiter.target(callback);
};

var addParticle = exports.addParticle = function(type, position, color, scale, update) {
    particles.push({
        type: type,
        position: position,
        color: color,
        scale: scale,
        update: update
    });
};

var addRocket = exports.addRocket = function(position, update) {
    rockets.push({
       position: position,
       update: update,
       rotateOffset: Math.random()
    });
};

var addExplosion = exports.addExplosion = function(position) {
    for(var i = 0; i < 4; ++i)
        (function(position) {
            var time = 0.55;
            var direction = [(Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)];
            var cloudsDone = false;
            addParticle('flame', position, [1,1,1,1], 5, function(tickTime) {
                this.position[0] += direction[0] * tickTime;
                this.position[1] += (direction[1] + exports.screenSpeed) * tickTime;
                this.position[2] + direction[2] * tickTime;
                this.color[3] = time / 0.55;
                this.scale = 5 + (0.55 - time) * 6;

                time -= tickTime;
                if(time < 0.4 && !cloudsDone) {
                    cloudsDone = true;
                    (function(lastPosition) {
                        var time = 3;
                        addParticle('cloud', lastPosition, [0.1,0.1,0.1,1], 8, function(tickTime) {
                            this.position[1] += exports.screenSpeed * tickTime;
                            this.color[3] = time > 2 ? (3 - time) / 4 : time / 8;
                            this.scale = 8 + (3 - time) / 2;
                            
                            time -= tickTime;
                            return time > 0;
                        });
                    })(this.position);
                }
                return time > 0;
            });
        })([position[0] + (Math.random() - 0.5), position[1] + (Math.random() - 0.5), position[2] + (Math.random() - 0.5)]);

    if(0)
    for(var i = 0; i < 6; ++i)
        (function(startPosition) {
            var alpha = Math.random() * Math.PI * 2;
            
            var direction = [Math.cos(alpha) * 40, Math.sin(alpha) * 40, 0];
            var time = 0.55;

            addParticle('flame', startPosition, [1,1,1,1], 1, function(tickTime) {
                this.position[0] += direction[0] * tickTime;
                this.position[1] += (exports.screenSpeed + direction[1]) * tickTime;
                this.position[2] += direction[2] * tickTime;
                
                //this.color[3] = time / 0.55;
                this.scale = 1 + (0.55 - time) * 3;

                time -= tickTime;
                return time > 0;
            });
        })([position[0], position[1], position[2]]);
};

exports.start = function() {
    var simulation = new Simulation(480, 400, -700, 600);
    $(document).keydown(function(event)
    {
        if (event.keyCode == 37)
            simulation.vdvMan.moveXSignal(1);
        else if (event.keyCode == 39)
            simulation.vdvMan.moveXSignal(-1);
        else if (event.keyCode == 38)
            simulation.vdvMan.moveYSignal(-1);
        else if (event.keyCode == 40)
            simulation.vdvMan.moveYSignal(1);
        else if (event.keyCode == 32)
            simulation.vdvMan.fireSignal(1);
    });
    
    $(document).keyup(function(event)
    {
        if (event.keyCode == 37 || event.keyCode == 39)
            simulation.vdvMan.moveXSignal(0);
        else if (event.keyCode == 38 || event.keyCode == 40)
            simulation.vdvMan.moveYSignal(0);   
        else if (event.keyCode == 32)
            simulation.vdvMan.fireSignal(0);
    });
    
	var projTransform = mat4.create();
	mat4.perspective(45, canvasWidth / canvasHeight, 1, 10000, projTransform);
    var viewTransform = mat4.create();
	var viewProjTransform = mat4.create();
	var invViewProjTransform = mat4.create();

    // параметры шейдеров
    var uniforms = {
		uCoords: [0, 0, 0, 0],
		uWorld: mat4.create(),
		uWorldViewProj: mat4.create(),
		uInvViewProj: invViewProjTransform,
		uEyePosition: null,
        uColorTexture: null,
        uMapOffset: [0, 0, 1000],
        uMapScale: [0.001, 0.0005],
        uBackTexture: textureBack,
        uStep: 0,
		uCloudTexture: null, // пока одна текстура
        uColorMultiplier: [0,0,0,0],
		uSize: [0, 0]
	};
    
    // для быстрого доступа
	// матрица мира
	var worldTransform = uniforms.uWorld;
	// матрица мир-вид-проекция
	var worldViewProjTransform = uniforms.uWorldViewProj;
    
    var eyeTarget = vec3.create();
    var up = [0, 0, 1];

    var time = 0;
    var lastTime = undefined;

    var wayToValue = function(current, target, halfTime, time) {
        return target + (current - target) * Math.exp(-time / halfTime * Math.LN2);
    };
    
    var clamp = function(v, min, max) {
        return v < min ? min : v > max ? max : v;
    };

    var eyePosition = exports.eyePosition;
    var eyeDirection = exports.eyeDirection;
    
    var eyeAlpha = -Math.PI * 0.5;
    var eyeBeta = -Math.PI * 0.4;
    eyePosition[0] = -eyeDirection[0] * 100;
    eyePosition[1] = -15-eyeDirection[1] * 100;
    eyePosition[2] = -eyeDirection[2] * 100;

    var lastVdvPosition = vec3.create();
    var vdvSpeed = vec3.create();

    var tick = function() {
        var nowTime = Date.now();
        var tickTime = (lastTime !== undefined ? nowTime - lastTime : 1) * 0.001;
        lastTime = nowTime;
        simulation.update(tickTime);
        
        vdvSpeed[0] = wayToValue(vdvSpeed[0], exports.vdvPosition[0] - lastVdvPosition[0], 5, tickTime);
        vdvSpeed[1] = wayToValue(vdvSpeed[1], exports.vdvPosition[1] - lastVdvPosition[1], 1, tickTime);
        vdvSpeed[2] = wayToValue(vdvSpeed[2], exports.vdvPosition[2] - lastVdvPosition[2], 5, tickTime);
        
        eyeAlpha = wayToValue(eyeAlpha, -Math.PI * 0.5 + vdvSpeed[0] * 2, 0.5, tickTime);
        eyeBeta = wayToValue(eyeBeta, -Math.PI * 0.4 + vdvSpeed[1] * -0.5, 0.2, tickTime);
        eyeBeta = clamp(eyeBeta, -Math.PI * 0.4, Math.PI * 0.4);
        eyeDirection[0] = Math.cos(eyeAlpha) * Math.cos(eyeBeta);
        eyeDirection[1] = Math.sin(eyeAlpha) * Math.cos(eyeBeta);
        eyeDirection[2] = Math.sin(eyeBeta);
        eyePosition[0] = -eyeDirection[0] * 100;
        eyePosition[1] = -5-eyeDirection[1] * 100;
        eyePosition[2] = -eyeDirection[2] * 100;
        
        lastVdvPosition[0] = exports.vdvPosition[0];
        lastVdvPosition[1] = exports.vdvPosition[1];
        lastVdvPosition[2] = exports.vdvPosition[2];
        
        uniforms.uMapOffset[1] -= tickTime * 40;
        uniforms.uMapScale[0] = 0.001;
        uniforms.uMapScale[1] = 0.001;

        // получить матрицу вида
        vec3.add(eyePosition, eyeDirection, eyeTarget);
    	mat4.lookAt(eyePosition, eyeTarget, up, viewTransform);
		// получить матрицу вид-проекция
		mat4.multiply(projTransform, viewTransform, viewProjTransform);
		// получить инвертированную матрицу вид-проекция
		mat4.inverse(viewProjTransform, invViewProjTransform);

        uniforms.uEyePosition = eyePosition;
        uniforms.uLightDirection = exports.lightDirection;

        engine.clear();
        
        // десантник
        uniforms.uColorTexture = textureVdv;
        mat4.identity(worldTransform);
        mat4.translate(worldTransform, exports.vdvPosition);
        mat4.scale(worldTransform, [0.25, 0.25, 0.25]);
        mat4.rotateX(worldTransform, Math.PI * 0.5);
        mat4.rotateZ(worldTransform, time * Math.PI * 2);
        mat4.multiply(viewProjTransform, worldTransform, worldViewProjTransform);
        engine.drawMorphed(programMorph, meshVDV, uniforms, time);

        time += tickTime / 2;
        while(time > 1)
            time -= 1;

        // ракеты
        if(rockets.length > 0) {
            uniforms.uColorTexture = textureRocket;

            var newRocketsCount = 0;
            for(var i = 0; i < rockets.length; ++i) {
                var rocket = rockets[i];
                
                if(rocket.update(tickTime)) {
                    mat4.identity(worldTransform);
                    mat4.translate(worldTransform, rocket.position);
                    mat4.rotateY(worldTransform, rocket.position[1] * 0.2 + rocket.rotateOffset);
                    mat4.rotateZ(worldTransform, Math.PI * 0.5);
                    mat4.multiply(viewProjTransform, worldTransform, worldViewProjTransform);
                    engine.draw(programSimple, meshRocket, uniforms);
                    
                    if(Math.random() < tickTime * 10)
                        (function() {
                            var time = 3;
                            var scale = (1 + Math.random() * 1) * 0.33;
                            var direction = [(Math.random() - 0.5) * 2, exports.screenSpeed + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2];
                            addParticle('cloud',
                                [rocket.position[0], rocket.position[1], rocket.position[2]],
                                [0.1, 0.1, 0.1, 0],
                                1,
                                function(tickTime) {
                                    this.position[0] += direction[0] * tickTime;
                                    this.position[1] += direction[1] * tickTime;
                                    this.position[2] += direction[2] * tickTime;
                                    this.color[3] = time * 0.2;
                                    this.scale = scale * (1 + (5 - time) * 0.4);
                                    time -= tickTime;
                                    return time > 0;
                                });
                        })();
                    
                    rockets[newRocketsCount++] = rocket;
                }
            }
            if(newRocketsCount != rockets.length)
                rockets.splice(newRocketsCount, rockets.length - newRocketsCount);
        }

        // небо
        engine.draw(programSky, meshSky, uniforms);

        //*** партиклы
        if(particles.length > 0) {
            // сортировка
            particles.sort(function(a, b) {
        		a = (a[0] - eyePosition[0]) * (a[0] - eyePosition[0]) + (a[1] - eyePosition[1]) * (a[1] - eyePosition[1]) + (a[2] - eyePosition[2]) * (a[2] - eyePosition[2]);
    			b = (b[0] - eyePosition[0]) * (b[0] - eyePosition[0]) + (b[1] - eyePosition[1]) * (b[1] - eyePosition[1]) + (b[2] - eyePosition[2]) * (b[2] - eyePosition[2]);
                return b - a;
            });
            // рисование, передвигание и убивание
        	engine.billboardMode(true);

            var newParticlesCount = 0;
            for(var i = 0; i < particles.length; ++i) {
                var particle = particles[i];
                
                if(particle.update(tickTime)) {
                    uniforms.uSize[0] = 6 * particle.scale;
                    uniforms.uSize[1] = 6 * particle.scale;
                    mat4.identity(worldTransform);
                    mat4.translate(worldTransform, particles[i].position);
                    mat4.multiply(viewProjTransform, worldTransform, worldViewProjTransform);
                    uniforms.uColor = particle.color;
                    uniforms.uCloudTexture = particleTypes[particle.type];
                    var additiveBlending = (particle.type == 'flame');
                    if(additiveBlending)
                        engine.additiveBlendingMode(true);
                    engine.draw(programCloud, meshCloud, uniforms);
                    if(additiveBlending)
                        engine.additiveBlendingMode(false);
                    
                    particles[newParticlesCount++] = particle;
                }
            }
        	engine.billboardMode(false);
            // убить лишние элементы с конца
            if(newParticlesCount != particles.length)
                particles.splice(newParticlesCount, particles.length - newParticlesCount);
        }

        setTimeout(tick, 0);
    };
    tick();
};

})(window.game = {});
