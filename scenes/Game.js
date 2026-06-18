// URL to explain PHASER scene: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/scene/

export default class Game extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init(data) {
    // Recibir score de nivel anterior si existe
    this.score = data.score || 0;
    this.level = data.level || 1;
  }

  preload() {
    this.load.tilemapTiledJSON("map", "public/assets/tilemap/map.json");
    this.load.image("tileset", "public/assets/texture.png");
    this.load.image("star", "public/assets/star.png");

    this.load.spritesheet("dude", "./public/assets/dude.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
  }

  create() {
    const map = this.make.tilemap({ key: "map" });

    // Parameters are the name you gave the tileset in Tiled and then the key of the tileset image in
    // Phaser's cache (i.e. the name you used in preload)
    const tileset = map.addTilesetImage("tileset", "tileset");

    // Parameters: layer name (or index) from Tiled, tileset, x, y
    const belowLayer = map.createLayer("Fondo", tileset, 0, 0);
    const platformLayer = map.createLayer("Plataformas", tileset, 0, 0);
    const objectsLayer = map.getObjectLayer("Objetos");

    // Find in the Object Layer, the name "dude" and get position
    const spawnPoint = map.findObject(
      "Objetos",
      (obj) => obj.name === "player"
    );
    console.log("spawnPoint", spawnPoint);

    this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, "dude");

    this.player.setBounce(0.2);
    this.player.setCollideWorldBounds(true);

    this.anims.create({
      key: "left",
      frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key: "turn",
      frames: [{ key: "dude", frame: 4 }],
      frameRate: 20,
    });

    this.anims.create({
      key: "right",
      frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 8 }),
      frameRate: 10,
      repeat: -1,
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    platformLayer.setCollisionByProperty({ esColisionable: true });
    this.physics.add.collider(this.player, platformLayer);

    // tiles marked as colliding
    /*
    const debugGraphics = this.add.graphics().setAlpha(0.75);
    platformLayer.renderDebug(debugGraphics, {
      tileColor: null, // Color of non-colliding tiles
      collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255), // Color of colliding tiles
      faceColor: new Phaser.Display.Color(40, 39, 37, 255), // Color of colliding face edges
    });
    */

    // Create empty group of starts
    this.stars = this.physics.add.group();

    // Create goal/finish point group
    this.goals = this.physics.add.group();

    // find object layer
    // if type is "stars", add to stars group
    objectsLayer.objects.forEach((objData) => {
      console.log(objData);
      const { x = 0, y = 0, name, type } = objData;
      switch (type) {
        case "star": {
          // add star to scene
          // console.log("estrella agregada: ", x, y);
          const star = this.stars.create(x, y, "star");
          star.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
          break;
        }
        case "goal": {
          // Create goal/finish sprite (using graphics)
          const goal = this.goals.create(x, y, null);
          goal.setScale(1.5);
          
          // Draw a circle or rectangle to represent the goal
          const graphics = this.make.graphics({ x: x, y: y, add: true });
          graphics.fillStyle(0xffff00, 1); // Yellow
          graphics.fillCircle(0, 0, 16);
          graphics.strokeStyle(0xff0000, 3); // Red border
          graphics.strokeCircle(0, 0, 16);
          graphics.setDepth(0);
          
          goal.setDisplayOrigin(16, 16);
          goal.goalGraphics = graphics;
          break;
        }
      }
    });

    // add collision between player and stars
    this.physics.add.collider(
      this.player,
      this.stars,
      this.collectStar,
      null,
      this
    );
    // add overlap between stars and platform layer
    this.physics.add.collider(this.stars, platformLayer);

    // add overlap between player and goal
    this.physics.add.overlap(
      this.player,
      this.goals,
      this.reachGoal,
      null,
      this
    );

    this.scoreText = this.add.text(16, 16, `Score: ${this.score}`, {
      fontSize: "32px",
      fill: "#000",
    });

    this.levelText = this.add.text(16, 60, `Level: ${this.level}`, {
      fontSize: "32px",
      fill: "#000",
    });

    this.itemsNeededText = this.add.text(16, 104, `Items: 0/5`, {
      fontSize: "32px",
      fill: "#000",
    });
  }

  reachGoal(player, goal) {
    const itemsCollected = Math.floor(this.score / 10);
    
    // Check if player has collected at least 5 items
    if (itemsCollected >= 5) {
      console.log("¡Ganaste el nivel!");
      // Move to next level
      this.level += 1;
      this.scene.restart({ score: this.score, level: this.level });
    } else {
      // Show message: need more items
      const msgText = this.add.text(
        this.cameras.main.centerX,
        this.cameras.main.centerY,
        `Necesitas ${5 - itemsCollected} item${5 - itemsCollected !== 1 ? 's' : ''} más!`,
        {
          fontSize: "48px",
          fill: "#ff0000",
          backgroundColor: "#ffffff",
          padding: { x: 20, y: 20 },
          align: "center",
        }
      );
      msgText.setOrigin(0.5);
      msgText.setDepth(100);
      
      // Remove message after 2 seconds
      this.time.delayedCall(2000, () => {
        msgText.destroy();
      });
    }
  }

  update() {
    // update game objects
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-160);

      this.player.anims.play("left", true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(160);

      this.player.anims.play("right", true);
    } else {
      this.player.setVelocityX(0);

      this.player.anims.play("turn");
    }

    if (this.cursors.up.isDown) {
      this.player.setVelocityY(-330);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
      console.log("Phaser.Input.Keyboard.JustDown(this.keyR)");
      this.scene.restart();
    }
  }

  collectStar(player, star) {
    star.disableBody(true, true);

    this.score += 10;
    
    // Update items collected counter
    const itemsCollected = Math.floor(this.score / 10);
    this.itemsNeededText.setText(`Items: ${itemsCollected}/5`);
    this.scoreText.setText(`Score: ${this.score}`);

    if (this.stars.countActive(true) === 0) {
      //  A new batch of stars to collect
      this.stars.children.iterate(function (child) {
        child.enableBody(true, child.x, 0, true, true);
      });
    }
  }
}
