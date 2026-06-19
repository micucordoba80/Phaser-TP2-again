// URL to explain PHASER scene: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/scene/

export default class Game extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init(data) {
    // Recibir score de nivel anterior si existe
    this.score = data.score || 0;
    this.level = data.level || 1;
    // Reset flag para evitar triggers múltiples
    this.reached = false;
    // Reset item count each level (score is cumulative)
    this.itemsCollected = 0;
  }

  preload() {
    this.load.tilemapTiledJSON("map", "public/assets/tilemap/map.json");
    this.load.tilemapTiledJSON("map2", "public/assets/tilemap/map2.json");
    this.load.tilemapTiledJSON("map3", "public/assets/tilemap/map3.json");
    this.load.image("tileset", "public/assets/texture.png");
    this.load.image("star", "public/assets/star.png");
    this.load.image("bomb", "public/assets/bomb.png");

    this.load.spritesheet("dude", "./public/assets/dude.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
    
  }

  create() {
    const mapKey = this.level === 3 ? "map3" : this.level === 2 ? "map2" : "map";
    const map = this.make.tilemap({ key: mapKey });

    const tilesetName = map.tilesets && map.tilesets.length ? map.tilesets[0].name : "tileset";
    const tileset = map.addTilesetImage(tilesetName, "tileset");

    const findTileLayer = (names) => {
      for (const name of names) {
        const layer = map.createLayer(name, tileset, 0, 0);
        if (layer) return layer;
      }
      return null;
    };

    const findObjectLayer = (names) => {
      for (const name of names) {
        const layer = map.getObjectLayer(name);
        if (layer) return layer;
      }
      return null;
    };

    const fondo = findTileLayer(["Fondo", "fondo"]);
    const platformLayer = findTileLayer(["Plataformas", "plataformas"]);
    const objectsLayer = findObjectLayer(["Objetos", "Capa de Objetos 1"]);

    if (!objectsLayer) {
      console.warn("No object layer found with the expected names. Current layers:", map.layers.map((l) => l.name));
    }

    const spawnPoint = objectsLayer
      ? map.findObject(objectsLayer.name, (obj) => obj.name === "player")
      : map.findObject("Objetos", (obj) => obj.name === "player");
    console.log("spawnPoint", spawnPoint);

    this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, "dude");
    if (this.player.body) this.player.body.allowGravity = false;
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(600, 600);

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

    // Set collisions for platform layer. Prefer tile property, fallback to all non-empty tiles.
    platformLayer.setCollisionByProperty({ esColisionable: true });
    platformLayer.setCollisionByExclusion([-1]);

    this.physics.add.collider(this.player, platformLayer);

    // Create stars group without gravity so they stay where placed
    this.stars = this.physics.add.group({ allowGravity: false });

    // Create goal/finish point
    this.goal = null;

    let goalCreated = false;
    if (objectsLayer && objectsLayer.objects) {
      objectsLayer.objects.forEach((objData) => {
        const { x = 0, y = 0, name, type } = objData;
        if (type === "star") {
          const star = this.stars.create(x, y, "star");
          if (star.body) {
            star.body.allowGravity = false;
            star.setImmovable(true);
          }
        } else if (type === "goal") {
          this.goal = this.physics.add.sprite(x, y, "bomb");
          this.goal.setScale(1.5);
          this.goal.setGravityY(-this.physics.world.gravity.y);
          this.goal.setVelocity(0, 0);
          this.goal.setCollideWorldBounds(true);
          goalCreated = true;
        }
      });
    } else {
      console.warn("No object layer found with the expected names");
    }

    if (!goalCreated) {
      this.goal = this.physics.add.sprite(700, 100, "bomb");
      this.goal.setScale(1.5);
      this.goal.setGravityY(-this.physics.world.gravity.y);
      this.goal.setVelocity(0, 0);
      this.goal.setCollideWorldBounds(true);
    }

    this.physics.add.collider(this.player, this.stars, this.collectStar, null, this);
    this.physics.add.collider(this.stars, platformLayer);
    this.physics.add.overlap(this.player, this.goal, this.reachGoal, null, this);

    this.stars.children.iterate((child) => {
      if (child && child.body) {
        child.originalX = child.x;
        child.originalY = child.y;
      }
    });

    this.scoreText = this.add.text(16, 16, `Score: ${this.score}`, {
      fontSize: "32px",
      fill: "#000",
    }).setScrollFactor(0);

    this.levelText = this.add.text(16, 60, `Level: ${this.level}`, {
      fontSize: "32px",
      fill: "#000",
    }).setScrollFactor(0);

    this.itemsCollected = 0;
    this.itemsNeededText = this.add.text(16, 104, `Items: ${this.itemsCollected}/5`, {
      fontSize: "32px",
      fill: "#000",
    }).setScrollFactor(0);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.roundPixels = true;
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }
  reachGoal(player, goal) {
    // Prevent double-triggering
    if (this.reached) {
      return;
    }

    const itemsCollected = this.itemsCollected;

    // Check if player has collected at least 5 items
    if (itemsCollected >= 5) {
      this.reached = true;
      if (this.level >= 3) {
        console.log("¡Ganaste el juego!", "Score:", this.score);
        if (this.player && this.player.body) {
          this.player.body.enable = false;
          this.player.setVelocity(0, 0);
          this.player.body.moves = false;
        }

        const overlay = this.add.rectangle(
          this.cameras.main.centerX,
          this.cameras.main.centerY,
          900,
          320,
          0x000000,
          0.75
        );
        overlay.setOrigin(0.5);
        overlay.setDepth(90);
        overlay.setScrollFactor(0);

        const winText = this.add.text(
          this.cameras.main.centerX,
          this.cameras.main.centerY - 80,
          "¡Ganaste el juego!",
          {
            fontSize: "72px",
            fill: "#7ee9a7",
            stroke: "#000000",
            strokeThickness: 10,
            align: "center",
          }
        );
        winText.setOrigin(0.5);
        winText.setDepth(100);
        winText.setScrollFactor(0);

        const scoreText = this.add.text(
          this.cameras.main.centerX,
          this.cameras.main.centerY + 10,
          `Puntaje final: ${this.score}`,
          {
            fontSize: "36px",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 5,
            align: "center",
          }
        );
        scoreText.setOrigin(0.5);
        scoreText.setDepth(100);
        scoreText.setScrollFactor(0);

        let countdown = 3;
        const restartText = this.add.text(
          this.cameras.main.centerX,
          this.cameras.main.centerY + 85,
          `Reiniciando en ${countdown}...`,
          {
            fontSize: "34px",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 5,
            align: "center",
          }
        );
        restartText.setOrigin(0.5);
        restartText.setDepth(100);
        restartText.setScrollFactor(0);

        this.time.addEvent({
          delay: 1000,
          repeat: 2,
          callback: () => {
            countdown -= 1;
            restartText.setText(`Reiniciando en ${countdown}...`);
          },
        });

        this.time.delayedCall(3000, () => {
          this.scene.start("game", { score: 0, level: 1 });
        });
      } else {
        console.log("¡Ganaste el nivel!", "Score:", this.score);
        this.level += 1;
        if (this.player && this.player.body) {
          this.player.body.enable = false;
        }
        this.time.delayedCall(500, () => {
          this.scene.start("game", { score: this.score, level: this.level });
        });
      }
    } else {
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

      this.time.delayedCall(2000, () => {
        msgText.destroy();
      });
    }
  }

  update() {
    // update game objects - 4-direction walking (no jump)
    const speed = 160;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown) {
      vx = -speed;
    } else if (this.cursors.right.isDown) {
      vx = speed;
    }

    if (this.cursors.up.isDown) {
      vy = -speed;
    } else if (this.cursors.down.isDown) {
      vy = speed;
    }

    // normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2; // 1/sqrt(2)
      vy *= Math.SQRT1_2;
    }

    this.player.setVelocity(vx, vy);

    // animations
    if (vx < 0) {
      this.player.anims.play("left", true);
    } else if (vx > 0) {
      this.player.anims.play("right", true);
    } else {
      this.player.anims.play("turn");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
      this.scene.restart();
    }
  }

  collectStar(player, star) {
    star.disableBody(true, true);

    this.score += 10;
    this.itemsCollected += 1;
    this.itemsNeededText.setText(`Items: ${this.itemsCollected}/5`);
    this.scoreText.setText(`Score: ${this.score}`);

    // No reappear stars in the same level. Stars should only reset on level change.
  }
}
