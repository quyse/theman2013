function inheritFromMixins()
{ 
    for (var i = 1, l = arguments.length; i < l; ++i)
    {
        var mixin = arguments[i];
        for (var p in mixin.prototype)
            arguments[0].prototype[p] = mixin.prototype[p];
        for (p in mixin)
            arguments[0].prototype[p] = mixin[p];
    }
}

function random(a, b)
{
    return a + Math.random() * (b - a);
}

function randint(n)
{
    return Math.floor(n * Math.random());
}

function distance(a, b)
{
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function doIntervalsIntersect(a0, a1, b0, b1)
{
    var tmp;
    if (a0 > a1)
    {
        tmp = a1;
        a1 = a0;
        a0 = tmp;
    }
    
    if (b0 > b1)
    {
        tmp = b1;
        b1 = b0;
        b0 = tmp;
    }
    
    return (b0 - a1) * (b1 - a0) < 0;
}

function clamp(value, min, max)
{
    if (value < min)
        return min;
    else if (value > max)
        return max;
    else
        return value;
}

var CIRCLE_COLLISION_GEOMETRY = 0;

function Point(x, y)
{
    this.x = x;
    this.y = y;     
}

function Circle(x, y, radius)
{
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.collisionGeometry = CIRCLE_COLLISION_GEOMETRY;
}

Circle.prototype = 
{
  
    hitTest: function(other)
    {
        if (other.collisionGeometry == CIRCLE_COLLISION_GEOMETRY)
        {
            var dx = other.x - this.x;
            var dy = other.y - this.y;
            var sumRadius = this.radius + other.radius;
            return dx * dx + dy * dy < sumRadius * sumRadius;
        }
        else
        {
            throw("NOT IMPLEMENTED COLLISION DETECTION WITH " + other);
        }
    }
    
};

var RelativelyMovingMixin = 
{
    
    move: function(dt)
    {
        this.x += dt * (this.velocity.x - this.inertialFrameVelocity.x);
        this.y += dt * (this.velocity.y - this.inertialFrameVelocity.y);
    }
    
};


var RendererDataProviderMixin =
{
    
    getRendererData: function()
    {
        var direction;
        if (this.velocity.y >= 0)
            direction = 1;
        else
            direction = -1;
        
        return {
            position: vec3.create([this.x, 0, this.y]), 
            direction: vec3.create([0, 0, direction]), 
            modelId: this.modelId,
            radius: this.radius,
            color: this.color
        };
    },
    
    syncPositionWithRender: function()
    {
        this.position[0] = this.x * COEF_RENDER;
        this.position[1] = this.y * COEF_RENDER;
    },
    
    renderCallback: function()
    {
        return !this.isDead;
    }
    
};


// gameplay constants
var COEF_RENDER = 0.1;


var DEFAULT_VDV_VELOCITY = -100;
var GUN_RECHARGE_TIME = 0.125;
var SPEED_BOOST_TIME = 5;
var SPEED_BOOST_COEF = 2;
var SPEED_DEBUFF_COEF = 0.075;
var SPEED_DEBUFF_DAMPING = 0.93;
var MULTISHOT_TIME = 5;
var MISSILE_MIN_VELOCITY = 350;
var MISSILE_MAX_VELOCITY = 600;
var MISSILE_EXPLOSION_RADIUS = 40;
var BULLET_VELOCITY = -800;
var BULLET_RADIUS = 1;
var VDVMAN_RADIUS = 30;
var MISSILE_RADIUS = 10;
var MIN_CLOUD_RADIUS = 40;
var MAX_CLOUD_RADIUS = 70;
var CLOUD_MAX_SPEED = 200;
var BOOST_RADIUS = 40;
var VICTORY_DISTANCE = 250000000000;
var VDV_OFFSET_VELOCITY = 550;
var VDV_MAX_VELOCITY = 300;
var VDV_VELOCITY_DAMP = 0.95;
var MAX_HP = 3;

// events ids
var MISSILE_EXPLODED_EVENT = 0;
var GAME_OVER_EVENT = 1;
var VDV_VICTORY_EVENT = 2;

function Cloud(x, y, radius, slowingSpeed, velocity)
{
    Circle.call(this, x, y, radius);
    this.velocity = new Point(0, velocity);
    this.slowingSpeed = slowingSpeed;
    this.position = [this.x, this.y, 0];
    
    var that = this;
    this.syncPositionWithRender();
    game.addParticle('cloud', this.position, [1, 1, 1, 1], radius * 0.06, function() { return that.renderCallback(); });
    
    this.color = "blue";
}

Cloud.prototype = 
{
    
    update: function(dt, simulation) 
    { 
        this.move(dt);
        this.syncPositionWithRender();
    },
    
    collideWithVDVMan: function(vdvMan, simulation)
    {
        vdvMan.pickupSlowDebuff(this.slowingSpeed);
    }
      
};
inheritFromMixins(Cloud, RelativelyMovingMixin, Circle, RendererDataProviderMixin);


function Missile(x, y, radius, velocity, damage)
{
    Circle.call(this, x, y, radius);
    this.velocity = new Point(0, velocity);
    this.damage = damage;
    this.position = [this.x, this.y, 0];
    
    var that = this;
    this.syncPositionWithRender();
    game.addRocket(this.position, function() { return that.renderCallback() });
    
    this.color = "red";
}

Missile.prototype = 
{
    
    update: function(dt, simulation) { 
        this.move(dt); 
        this.syncPositionWithRender();
    },
    
    collideWithVDVMan: function(vdvMan, simulation)
    {
       // console.log(vdvMan)
        if (!this.isDead)
        {
            //console.log("Holy shit")
            this.isDead = true;
            this.explode(vdvMan, simulation);
            simulation.addEvent({id: MISSILE_EXPLODED_EVENT, x: this.x, y: this.y});
        }
    },
    
    collideWithBullet: function(bullet, simulation)
    {
        if (!this.isDead)
        {
            this.isDead = true;
            bullet.destroyedMissile(this, simulation);
            this.explode(simulation.vdvMan);
            simulation.addEvent({id: MISSILE_EXPLODED_EVENT, x: this.x, y: this.y});
        }
    },
    
    explode: function(vdvMan, simulation)
    {
        if (distance(vdvMan, this) < MISSILE_EXPLOSION_RADIUS)
            vdvMan.receiveDamage(1, simulation);        
    }
    
};
inheritFromMixins(Missile, RelativelyMovingMixin, Circle, RendererDataProviderMixin);


function Boost(x, y, radius, hp, speedTime, speedBonus, multishotTime)
{
    Circle.call(this, x, y, radius);
    this.hp = hp;
    this.speedTime = speedTime;
    this.speedBonus = speedBonus;
    this.multishotTime = multishotTime;
    this.velocity = new Point(0, 0);
    this.position = [this.x, this.y, 0];
    this.semiDead = false;
    this.deadTime = 0;
    
    var that = this;
    this.syncPositionWithRender();
    game.addParticle(Math.random() < 0.5 ? "putin" : "medvedev", this.position, [1, 1, 1, 1], radius * 0.066, function() { return that.renderCallbackX(this); });
    
    this.color = "green";
}

Boost.prototype = 
{
    
    update: function(dt, simulation) 
    { 
        if (this.semiDead)
        {
            this.deadTime -= dt;
            if (this.deadTime < 0)
                this.isDead = true;
        }
        this.move(dt); 
        this.syncPositionWithRender();
    },
    
    collideWithVDVMan: function(vdvMan, simulation)
    {
        if (!this.semiDead)
        {
            vdvMan.pickupHealth(this.hp);
            vdvMan.pickupMultishot(this.multishotTime);
            if (this.speedTime > 0)
                vdvMan.pickupSpeedBoost(this.speedBonus, this.speedTime);
            this.semiDead = true;
            this.deadTime = 0.25;
            vdvMan.destroyedMissile();
        }
    },
    
    renderCallbackX: function(obj)
    {
        obj.scale = 1.98 + 1.25 * this.deadTime / 0.25;
        obj.alpha = this.deadTime * this.deadTime / 0.25 / 0.25;
        return !this.isDead;
    }

};
inheritFromMixins(Boost, RelativelyMovingMixin, Circle, RendererDataProviderMixin);


function Bullet(owner, x, y, radius, velocityX, velocityY)
{
    Circle.call(this, x, y, radius);
    this.owner = owner;
    this.velocity = new Point(velocityX, velocityY);
    this.position = [this.x, this.y, 0];
    
    var that = this;
    this.syncPositionWithRender();
    game.addParticle('bullet', this.position, [1, 1, 1, 1], radius * 0.5, function() { return that.renderCallback(); });
    
    this.color = "orange";
}

Bullet.prototype = 
{
    
    update: function(dt, simulation)
    {
        this.move(dt);
        this.syncPositionWithRender();
        var collidesWith = simulation.hitTest(this);
        for (var i = 0, l = collidesWith.length; i < l; ++i)
        {
            if (collidesWith[i].collideWithBullet)
                collidesWith[i].collideWithBullet(this, simulation);
        }
    },
    
    destroyedMissile: function(missile, simulation)
    {
        this.isDead = true;
        this.owner.destroyedMissile(missile);
    }
    
};
inheritFromMixins(Bullet, RelativelyMovingMixin, Circle, RendererDataProviderMixin);


function VDVMan()
{
    Circle.call(this, 0, 0, VDVMAN_RADIUS);
    this.velocity = new Point(0, DEFAULT_VDV_VELOCITY);
    
    this.hp = MAX_HP;
    this.multishotTimeLeft = 0; 
    this.gunRechargeTimeLeft = 0;
    this.speedBoostTimeLeft = 0;
    this.speedDebuffTimeLeft = 0;
    this.speedBoost = 1;
    this.speedDebuff = 1;
    this.missilesDestroyed = 0;
    this.distanceFlown = 0;
    this.fireIntention = 0;
    this.moveXIntention = 0;
    this.moveYIntention = 0;
    this.offsetVelocity = new Point(0, 0);
    
    this.color = "black";
}

VDVMan.prototype = 
{
    
    update: function(dt, simulation) {},
    
    epicUpdate: function(dt, simulation)
    {
        if (this.multishotTimeLeft > 0)
            this.multishotTimeLeft -= dt;
        
        this.updateWeapons(dt, simulation);
        this.updateVelocity(dt);
        this.updateOffset(dt, simulation);
        
        var collidedWith = simulation.hitTest(this);
        for (var i = 0, l = collidedWith.length; i < l; i++)
        {
            if (collidedWith[i].collideWithVDVMan)
                collidedWith[i].collideWithVDVMan(this, simulation);
        }
        
        this.distanceFlown += Math.abs(this.velocity.y) * dt;
        if (Math.abs(this.distanceFlown) >= VICTORY_DISTANCE)
            simulation.addEvent({id: VDV_VICTORY_EVENT});
        
        //console.log(this.x, this.y)
        game.vdvPosition[0] = 2 * this.x * COEF_RENDER;
        game.vdvPosition[1] = 2 * this.y * COEF_RENDER - 17;
        game.vdvPosition[2] = -80;
    },
    
    moveXSignal: function(signal)
    {
        if (!this.isDead)
            this.moveXIntention = signal;
    },
    
    moveYSignal: function(signal)
    {
        if (!this.isDead)
            this.moveYIntention = signal;
    },
    
    fireSignal: function(signal)
    {
        if (!this.isDead)
            this.fireIntention = signal;  
    },
    
    updateWeapons: function(dt, simulation)
    {
        if (this.gunRechargeTimeLeft > 0)
            this.gunRechargeTimeLeft -= dt;
        
        if (this.gunRechargeTimeLeft <= 0 && this.fireIntention)
        {
            this.fireIntention = 0;
            this.gunRechargeTimeLeft = GUN_RECHARGE_TIME;
            simulation.createBulletAt(this, this);
            if (this.multishotTimeLeft > 0)
            {
                var angles = [-0.2, 0.2];
                for (var i = 0, l = angles.length; i < l; i++)
                {
                    simulation.createBulletAt(this, this, angles[i]);
                }
            }
        }
        
        this.fireIntention = false;
    },
    
    updateVelocity: function(dt)
    {
        this.velocity.y = DEFAULT_VDV_VELOCITY;
        this.speedDebuff *= SPEED_DEBUFF_DAMPING;
        
        if (this.speedBoostTimeLeft > 0)
        {
            this.speedBoostTimeLeft -= dt;
            this.velocity.y *= this.speedBoost;
        }
            
        this.velocity.y /= (1 + this.speedDebuff);
    },
    
    updateOffset: function(dt, simulation)
    {
        this.offsetVelocity.x = this.moveXIntention * VDV_OFFSET_VELOCITY;
        this.offsetVelocity.y = this.moveYIntention * VDV_OFFSET_VELOCITY;        
        this.x = clamp(this.x + dt * this.offsetVelocity.x, -0.5 * simulation.width, 0.5 * simulation.width);
        this.y = clamp(this.y + dt * this.offsetVelocity.y, -1 * simulation.height, 0.5 * simulation.height);
   },
    
    pickupSpeedBoost: function(speed, time)
    {
        this.speedBoost = speed;
        this.speedBoostTimeLeft = time;
    },
    
    pickupSlowDebuff: function(speed, time)
    {
        this.speedDebuff += speed;  
    },
    
    pickupMultishot: function(time)
    {
        this.multishotTimeLeft += time;
    },
    
    pickupHealth: function(hp)
    {
        this.hp = clamp(this.hp + 1, 0, MAX_HP);
    },
    
    receiveDamage: function(damage, simulation)
    {
        if (this.hp > 0)
        {
            this.hp -= damage;
            //console.log("damaged!");
            if (this.hp <= 0)
            {
                this.isDead = true;
                simulation.addEvent({id: GAME_OVER_EVENT});
            }
        }
    },
    
    destroyedMissile: function(missile)
    {
        this.missilesDestroyed++;
    }
    
};
inheritFromMixins(VDVMan, Circle, RendererDataProviderMixin);


function Simulation(width, height, objectCutoffMinY, objectCutoffMaxY)
{
    this.width = width;
    this.height = height;
    
    this.time = 0;
    
    this.objectCutoffMinY = objectCutoffMinY; 
    this.objectCutoffMaxY = objectCutoffMaxY;
    
    this.vdvMan = new VDVMan();
    this.vdvMan.y = 0.5 * this.height;
    this.vdvMan.x = 0;
    this.inertialFrameVelocity = this.vdvMan.velocity;
    
    this.lastMissileCheckpoint = 0;
    this.lastCloudCheckpoint = 0;
    this.lastBonusSpawnTime = 0;
    this.won = false;
    
    this.objects = [this.vdvMan];
    this.events = [];
    
    game.screenSpeed = Math.abs(DEFAULT_VDV_VELOCITY) * COEF_RENDER;
}

Simulation.prototype =
{
    
    update: function(dt, simulation)
    {  
        if (this.vdvMan.isDead || this.won)
            return;
        
        this.spawnThreatsAndBonuses();
        this.vdvMan.epicUpdate(dt, this);
        
        for (var i = 0, l = this.objects.length; i < l; ++i)
        {
            var object = this.objects[i];
            object.update(dt, this);
            if (object.y < this.objectCutoffMinY || object.y > this.objectCutoffMaxY || object.isDead)
            {
                //console.log("destroyed", this.objects[i]);
                this.objects[i].isDead = true;
                this.objects[i] = this.objects[l - 1];
                this.objects.pop();
                --i;
                --l;
            }
        }
        
        this.time += dt;
        
        $("#health").text("Health: " + this.vdvMan.hp);
        $("#score").text("Score: " + Math.round(this.vdvMan.missilesDestroyed));
        
        var thisFrameEvents = this.events;
        for (var i = 0, l = thisFrameEvents.length; i < l; ++i)
        {
            var event = thisFrameEvents[i];
            if (event.id == GAME_OVER_EVENT)
            {
                $("#result").text("THE TYRANNY HAS PREVAILED! SCORE: " + Math.round(this.vdvMan.missilesDestroyed))
            }
            else if (event.id == MISSILE_EXPLODED_EVENT)
            {
                game.addExplosion([event.x * COEF_RENDER, event.y * COEF_RENDER, 0]);
            }
            
        }
        
        this.events = [];
        return thisFrameEvents;
    },
    
    addEvent: function(event)
    {
        this.events.push(event);  
    },
    
    setInertialFrameVelocity: function(velocity)
    {
        this.velocity = velocity;
        for (var i = 0, l = this.objects.length; i < l; ++i)
            this.objects[i].inertialFrameVelocity = velocity;
    },
    
    hitTest: function(testedObject)
    {
        var result = [];
        for (var i = 0, l = this.objects.length; i < l; i++)
        {
            var object = this.objects[i];
            if (object == testedObject)
                continue;
            if (testedObject.hitTest(object))
                result.push(object);
        }
        return result;
    },
    
    addObject: function(movingObject)
    {
        this.objects.push(movingObject);
        movingObject.inertialFrameVelocity = this.inertialFrameVelocity;
    },
    
    spawnThreatsAndBonuses: function()
    {
        this.trySpawnBoosts();
        this.trySpawnMissiles();
        this.trySpawnClouds();
    },
    
    trySpawnBoosts: function()
    {
        var delta = this.vdvMan.distanceFlown - this.lastBonusSpawnTime;
        delta = clamp(delta, 0, 20000);
        var probability = Math.pow(delta / 20000, 2);
        if (probability > Math.random())
        {
            var x = random(-this.width * 0.5, this.width * 0.5);
            var y = this.objectCutoffMinY;
            var type = randint(2);
            var boost;
            switch (type)
            {
                case 0: boost = new Boost(x, y, BOOST_RADIUS, 1, 0, 0, 0); break;
                case 1: boost = new Boost(x, y, BOOST_RADIUS, 0, 0, 0, MULTISHOT_TIME); break;
            }
            this.lastBonusSpawnTime = this.vdvMan.distanceFlown;
            this.addObject(boost);
        }
    },
    
    trySpawnMissiles: function()
    {
        var iteration = 0;
        while (this.lastMissileCheckpoint < this.vdvMan.distanceFlown)
        {
            var hardcoreness = 0.25 * (Math.abs(this.vdvMan.distanceFlown) / VICTORY_DISTANCE);
            if (Math.random() < 0.1 + hardcoreness)
            {
                var count = Math.random() < 0.1 + hardcoreness ? 2 : 1;
                while (count--)
                {
                    var x = random(-this.width * 0.5, this.width * 0.5);
                    var missile = new Missile(x, this.objectCutoffMinY + iteration * 5, MISSILE_RADIUS, (1 + hardcoreness) * random(MISSILE_MIN_VELOCITY, MISSILE_MAX_VELOCITY), 1);
                    this.addObject(missile);
                }
            }
            this.lastMissileCheckpoint += 5;
            iteration++;            
        }
    },
    
    trySpawnClouds: function()
    {
        var iteration = 0;
        while (this.lastCloudCheckpoint < this.vdvMan.distanceFlown)
        {
            var hardcoreness = 0.025 * (Math.abs(this.vdvMan.distanceFlown) / VICTORY_DISTANCE);
            if (Math.random() < 0.05 + hardcoreness)
            {
                var count = Math.random() < 0.05 + hardcoreness ? 2 : 1;
                while (count--)
                {
                    var x = random(-this.width * 0.5, this.width * 0.5);
                    var r = random(MIN_CLOUD_RADIUS, MAX_CLOUD_RADIUS);
                    var cloud = new Cloud(x, this.objectCutoffMinY + 5 * iteration, r, SPEED_DEBUFF_COEF, random(0.5 * CLOUD_MAX_SPEED, CLOUD_MAX_SPEED));
                    this.addObject(cloud);
                }
            } 
            this.lastCloudCheckpoint += 5;
            iteration++;
        }
    },
    
    createBulletAt: function(location, owner, angle)
    {
        angle = angle || 0;
        var velocityX = Math.cos(angle + 0.5 * Math.PI) * BULLET_VELOCITY;
        var velocityY = Math.sin(angle + 0.5 * Math.PI) * BULLET_VELOCITY;
        var bullet = new Bullet(owner, location.x, location.y, BULLET_RADIUS, velocityX, velocityY);
        this.addObject(bullet);
    },
    
    getRendererData: function()
    {
        var data = [];
        for (var i = 0, l = this.objects.length; i < l; i++)
        {
            var renderData = this.objects[i].getRendererData();
            renderData.time = this.time;
            data.push(renderData);
        }
        return data;
    }
    
};


function debugDraw(canvasId, rectangles, width, height)
{
    var canvas = $("#" + canvasId);
    var children = canvas.children();
    var rectanglesCount = rectangles.length;
    var divsCount = children.length;

    while (divsCount < rectanglesCount)
    {
        var newChild = $("<div style='position: absolute'></div>");
        canvas.append(newChild);
        divsCount++;
    }
    
    children = canvas.children();
    for (var i = 0; i < rectanglesCount; ++i)
    {
        var div = children[i];
        var rect = rectangles[i];
        var pos = rect.position;
        $(div).css("left", 0.5 * width + pos[0] - rect.radius);
        $(div).css("top", 0.5 * height + pos[2] - rect.radius);
        $(div).css("width", 2 * rect.radius);
        $(div).css("height", 2 * rect.radius);
        $(div).css("background", rect.color);
        $(div).css("visibility", "visible");
    }

    for (i = rectanglesCount; i < children.length; ++i)
        $(children[i]).css("visibility", "hidden");
}
