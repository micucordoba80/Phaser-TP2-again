// URL to explain PHASER scene: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/scene/

export default class Game extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init() {
    this.score = 0;
  }

  preload() {
    this.load.tilemapTiledJSON("map", "public/assets/tilemap/big_map.json");
    this.load.image("tileset", "public/assets/tilemap_packed.png");
    this.load.image("star", "public/assets/star.png");
    this.load.image("bomb", "public/assets/bomb.png");

    this.load.spritesheet("dude", "./public/assets/dude.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
  }

  create() {
    const map = this.make.tilemap({ key: "map" });
    const tileset = map.addTilesetImage("platform", "tileset");
    const platformLayer = map.createLayer("Plataformas", tileset, 0, 0);
    const objectsLayer = map.getObjectLayer("Objetos");

    const spawnPoint = map.findObject(
      "Objetos",
      (obj) => obj.name === "player"
    );
    console.log("spawnPoint", spawnPoint);

    this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, "dude");

    // Remove collision with world bounds
    this.player.body.setCollideWorldBounds(false);

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

    this.stars = this.physics.add.group();
    this.targets = this.physics.add.group();

    console.log("objectsLayer", objectsLayer.objects);

    objectsLayer.objects.forEach((objData) => {
      const { x = 0, y = 0, type, name } = objData;
      if (type === "star") {
        const star = this.stars.create(x, y, "star");
      }
      if (name === "target") {
        const target = this.targets.create(x, y, "star");
        target.setTint(0xff0000);
      }

      if (name === "enemy1") {
        // Create an enemy that moves horizontally
        const enemy = this.physics.add.sprite(x, y, "bomb");
        enemy.setBounce(1);
        enemy.setVelocity(100, 0);
        this.physics.add.collider(enemy, platformLayer);
      }

      if (name === "enemy2") {
        // Create an enemy that moves with linear tweens
        const enemy = this.physics.add.sprite(x, y, "bomb");
        enemy.setBounce(1);
        enemy.setVelocity(0, 1000);
        this.physics.add.collider(enemy, platformLayer);
        this.tweens.add({
          targets: enemy,
          y: enemy.y + 300,
          duration: 2000,
          ease: "Power4", // options> "Linear", "Sine.easeInOut", "Power2", "Power3", "Power4"
          yoyo: true,
          repeat: -1,
        });
      }

      if (name === "enemy3") {
        // Create an enemy that moves with sin tweens
        const enemy = this.physics.add.sprite(x, y, "bomb");
        enemy.setBounce(1);
        enemy.setVelocity(0, Phaser.Math.Between(-200, 200));
        this.physics.add.collider(enemy, platformLayer);
        // Movimiento en onda senoidal hacia adelante
        this.tweens.addCounter({
          from: 0,
          to: Math.PI * 2,
          duration: 5000,
          repeat: -1,
          onUpdate: (tween) => {
            const t = tween.getValue();
            // Movimiento hacia la derecha (x) y onda senoidal en y
            enemy.x = x + t * 50; // avance horizontal
            enemy.y = y + Math.sin(t) * 25; // onda vertical
          },
        });
      }

      if (name === "enemy4") {
        // Create an enemy that moves with circular tweens
        const enemy = this.physics.add.sprite(x, y, "bomb");
        enemy.setBounce(1);
        enemy.setVelocity(0, Phaser.Math.Between(-200, 200));
        this.physics.add.collider(enemy, platformLayer);

        this.tweens.addCounter({
          from: 0,
          to: Math.PI * 2,
          duration: 5000,
          repeat: -1,
          onUpdate: (tween) => {
            const t = tween.getValue();
            // Movimiento circular
            enemy.x = x + Math.cos(t) * 50; // radio de 50
            enemy.y = y + Math.sin(t) * 50; // radio de 50
          },
        });
      }
    });

    const enemy_start = objectsLayer.objects.find(
      (obj) => obj.name === "enemy_start"
    );
    const enemy_finish = objectsLayer.objects.find(
      (obj) => obj.name === "enemy_finish"
    );

    if (enemy_start && enemy_finish) {
      // Create an enemy that moves between two points
      const enemy = this.physics.add.sprite(
        enemy_start.x,
        enemy_start.y,
        "bomb"
      );
      enemy.setBounce(1);
      enemy.setVelocityX(100); // Velocidad inicial hacia la derecha
      this.physics.add.collider(enemy, platformLayer);

      this.tweens.add({
        targets: enemy,
        x: enemy_finish.x,
        y: enemy_finish.y,
        duration: 2000,
        ease: "Power2",
        yoyo: false,
        repeat: 3,
      });
    }

    this.physics.add.collider(this.stars, platformLayer);
    this.physics.add.overlap(
      this.player,
      this.stars,
      this.collectStar,
      null,
      this
    );

    //colison con el target
    this.physics.add.overlap(
      this.player,
      this.targets,
      this.handleTargetCollision,
      null,
      this
    );

    this.scoreText = this.add.text(16, 16, `Score: ${this.score}`, {
      fontSize: "32px",
      fill: "#000",
    });

    // Configure the camera to follow the player
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  update() {
    // Remove restrictions on player movement
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-160);
      this.player.anims.play("left", true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(160);
      this.player.anims.play("right", true);
    } else {
      this.player.setVelocityX(0);
    }

    if (this.cursors.up.isDown) {
      this.player.setVelocityY(-160);
    } else if (this.cursors.down.isDown) {
      this.player.setVelocityY(160);
    } else {
      this.player.setVelocityY(0);
    }

    if (
      this.player.body.velocity.x === 0 &&
      this.player.body.velocity.y === 0
    ) {
      this.player.anims.play("turn");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
      console.log("Phaser.Input.Keyboard.JustDown(this.keyR)");
      this.scene.restart();
    }

    // move score text to the top right corner

    this.scoreText.setPosition(
      this.cameras.main.worldView.x +
        this.cameras.main.worldView.width -
        16 -
        this.scoreText.width,
      this.cameras.main.worldView.y + 16
    );
  }

  collectStar(player, star) {
    star.disableBody(true, true);
    this.score += 10;
    this.scoreText.setText(`Score: ${this.score}`);
  }

  handleTargetCollision(player, target) {
    console.log("Collision with target!");

    // Mostrar el texto de victoria en el centro de la vista actual de la cámara
    this.add
      .text(
        this.cameras.main.worldView.centerX,
        this.cameras.main.worldView.centerY,
        "¡Victoria!",
        {
          fontSize: "64px",
          fill: "#fff",
        }
      )
      .setOrigin(0.5, 0.5);

    this.player.setTint(0x00ff00); // Cambiar el color del jugador para indicar victoria
  }
}
