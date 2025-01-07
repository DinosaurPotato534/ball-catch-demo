import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import "./App.css";

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [appState, setAppState] = useState<
    "start" | "initializing" | "complete" | "gameover"
  >("start");
  const [isLocked, setIsLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (!mountRef.current || !videoRef.current || appState === "start") return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(0, 8, 0);
    pointLight.castShadow = true;
    scene.add(pointLight);

    const roomWidth = 20;
    const roomHeight = 10;
    const roomDepth = 20;

    const wallMaterial = new THREE.MeshPhongMaterial({
      color: 0xe0e0e0,
      side: THREE.DoubleSide,
    });

    const floorMaterial = new THREE.MeshPhongMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide,
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(roomWidth, roomDepth),
      floorMaterial
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(roomWidth, roomDepth),
      wallMaterial
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(roomWidth, roomHeight),
      wallMaterial
    );
    backWall.position.z = -roomDepth / 2;
    backWall.position.y = roomHeight / 2;
    backWall.receiveShadow = true;
    scene.add(backWall);

    const frontWall = new THREE.Mesh(
      new THREE.PlaneGeometry(roomWidth, roomHeight),
      wallMaterial
    );
    frontWall.position.z = roomDepth / 2;
    frontWall.position.y = roomHeight / 2;
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = true;
    scene.add(frontWall);

    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(roomDepth, roomHeight),
      wallMaterial
    );
    leftWall.position.x = -roomWidth / 2;
    leftWall.position.y = roomHeight / 2;
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(roomDepth, roomHeight),
      wallMaterial
    );
    rightWall.position.x = roomWidth / 2;
    rightWall.position.y = roomHeight / 2;
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    const gridHelper = new THREE.GridHelper(roomWidth, 20, 0x000000, 0x444444);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    camera.position.set(0, 1.7, 5);
    camera.lookAt(0, 1.7, 0);

    const controls = new PointerLockControls(camera, renderer.domElement);

    const moveSpeed = 0.1;
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
    };

    const onLockChange = () => {
      setIsLocked(document.pointerLockElement === renderer.domElement);
    };

    document.addEventListener("pointerlockchange", onLockChange);

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
          moveState.forward = true;
          break;
        case "KeyS":
          moveState.backward = true;
          break;
        case "KeyA":
          moveState.left = true;
          break;
        case "KeyD":
          moveState.right = true;
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
          moveState.forward = false;
          break;
        case "KeyS":
          moveState.backward = false;
          break;
        case "KeyA":
          moveState.left = false;
          break;
        case "KeyD":
          moveState.right = false;
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    const onClick = () => {
      controls.lock();
    };
    renderer.domElement.addEventListener("click", onClick);

    const HAND_CONNECTIONS = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20],
      [5, 9],
      [9, 13],
      [13, 17],
    ];

    const createHandMesh = (color: number) => {
      const group = new THREE.Group();

      const lineGeometry = new THREE.BufferGeometry();
      const lineMaterial = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
        transparent: true,
        opacity: 0.8,
      });
      const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
      group.add(lines);

      const joints: THREE.Mesh[] = [];
      const jointPositions: THREE.Vector3[] = [];

      for (let i = 0; i < 21; i++) {
        const size = i === 0 ? 0.12 : i % 4 === 0 ? 0.08 : 0.06;
        const sphereGeometry = new THREE.SphereGeometry(size);
        const sphereMaterial = new THREE.MeshPhongMaterial({
          color,
          shininess: 30,
          transparent: true,
          opacity: 0.9,
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        joints.push(sphere);
        jointPositions.push(new THREE.Vector3());
        group.add(sphere);
      }

      const aimLineGeometry = new THREE.BufferGeometry();
      const aimLineMaterial = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
      });
      const indexAimLine = new THREE.LineSegments(
        aimLineGeometry,
        aimLineMaterial
      );
      group.add(indexAimLine);

      const previousAimDirection = new THREE.Vector3();

      return {
        group,
        lines,
        joints,
        jointPositions,
        indexAimLine,
        previousAimDirection,
      };
    };

    const leftHand = createHandMesh(0x00ff00);
    const rightHand = createHandMesh(0xff0000);
    scene.add(leftHand.group);
    scene.add(rightHand.group);

    const handTracking = {
      left: {
        velocity: new THREE.Vector3(),
        lastPosition: new THREE.Vector3(),
        targetPosition: new THREE.Vector3(),
        currentPosition: new THREE.Vector3(),
        smoothVelocity: new THREE.Vector3(),
        positionSmoothing: 0.1,
        rotationSmoothing: 0.1,
        thumbHistory: [],
        currentShotState: "READY",
        lastStateChange: 0,
        lastSuccessfulShot: 0,
      },
      right: {
        velocity: new THREE.Vector3(),
        lastPosition: new THREE.Vector3(),
        targetPosition: new THREE.Vector3(),
        currentPosition: new THREE.Vector3(),
        smoothVelocity: new THREE.Vector3(),
        positionSmoothing: 0.1,
        rotationSmoothing: 0.1,
        thumbHistory: [],
        currentShotState: "READY",
        lastStateChange: 0,
        lastSuccessfulShot: 0,
      },
    };

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.2,
      minTrackingConfidence: 0.2,
    });

    const smoothValue = (
      current: number,
      target: number,
      smoothing: number
    ) => {
      return current + (target - current) * smoothing;
    };

    const smoothPosition = (
      current: THREE.Vector3,
      target: THREE.Vector3,
      smoothing: number
    ) => {
      current.x = smoothValue(current.x, target.x, smoothing);
      current.y = smoothValue(current.y, target.y, smoothing);
      current.z = smoothValue(current.z, target.z, smoothing);
    };

    const gestureHistory = {
      left: [] as boolean[],
      right: [] as boolean[],
    };

    const HISTORY_LENGTH = 3;

    const isFingerGunGesture = (joints: THREE.Mesh[]) => {
      const getSegment = (start: number, end: number) => {
        return new THREE.Vector3()
          .subVectors(joints[end].position, joints[start].position)
          .normalize();
      };

      for (let i = 0; i < joints.length; i++) {
        if (!joints[i].position) return false;
      }

      const middleSeg1 = getSegment(9, 10);
      const middleSeg3 = getSegment(11, 12);
      const isMiddleCurled = middleSeg1.dot(middleSeg3) < -0.15;

      const isRingCurled = getSegment(13, 14).dot(getSegment(15, 16)) < 0;
      const isPinkyCurled = getSegment(17, 18).dot(getSegment(19, 20)) < 0;

      const palmCenter = joints[0].position;
      const indexTip = joints[8].position;
      const thumbTip = joints[4].position;

      const palmLength = palmCenter.distanceTo(joints[5].position);
      const thumbToIndex = thumbTip.distanceTo(indexTip);
      const isThumbPositioned = thumbToIndex > palmLength * 0.45;

      const cameraDir = new THREE.Vector3()
        .subVectors(joints[0].position, camera.position)
        .normalize();
      const wristDir = new THREE.Vector3()
        .subVectors(joints[9].position, joints[0].position)
        .normalize();
      if (cameraDir.dot(wristDir) > 0.4) {
        return isThumbPositioned;
      }

      return (
        isMiddleCurled && isRingCurled && isPinkyCurled && isThumbPositioned
      );
    };

    const shoot = (position: THREE.Vector3, direction: THREE.Vector3) => {
      const bulletGeometry = new THREE.SphereGeometry(0.1);
      const bulletMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5,
      });
      const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

      bullet.position.copy(position);
      scene.add(bullet);

      const bulletSpeed = 1.5;
      const bulletVelocity = direction.clone().multiplyScalar(bulletSpeed);

      const bulletAnimate = () => {
        bullet.position.add(bulletVelocity);

        const bulletPos = bullet.position;
        targets.forEach((target, index) => {
          if (bulletPos.distanceTo(target.position) < 0.5) {
            scene.remove(target);
            scene.remove(bullet);
            targets.splice(index, 1);
            setScore((prev) => prev + 100);

            setTimeout(() => {
              if (appState === "complete") {
                createTarget();
              }
            }, TARGET_RESPAWN_TIME);
            return;
          }
        });

        if (bullet.position.distanceTo(position) > 20) {
          scene.remove(bullet);
          return;
        }

        if (bullet.parent === scene) {
          requestAnimationFrame(bulletAnimate);
        }
      };

      bulletAnimate();

      const screenPos = position.clone().project(camera);
      const x = ((screenPos.x + 1) / 2) * window.innerWidth;
      const y = ((-screenPos.y + 1) / 2) * window.innerHeight;

      const flashEffect = document.createElement("div");
      flashEffect.style.position = "absolute";
      flashEffect.style.width = "20px";
      flashEffect.style.height = "20px";
      flashEffect.style.backgroundColor = "yellow";
      flashEffect.style.borderRadius = "50%";
      flashEffect.style.transform = "translate(-50%, -50%)";
      flashEffect.style.left = `${x}px`;
      flashEffect.style.top = `${y}px`;
      flashEffect.style.zIndex = "1000";
      document.body.appendChild(flashEffect);

      const bangText = document.createElement("div");
      bangText.innerText = "BANG!";
      bangText.style.position = "absolute";
      bangText.style.color = "red";
      bangText.style.fontSize = "24px";
      bangText.style.fontWeight = "bold";
      bangText.style.transform = "translate(-50%, -50%)";
      bangText.style.left = `${x}px`;
      bangText.style.top = `${y - 30}px`;
      bangText.style.zIndex = "1000";
      document.body.appendChild(bangText);

      setTimeout(() => {
        document.body.removeChild(flashEffect);
        document.body.removeChild(bangText);
      }, 200);
    };

    const smoothGestureDetection = (
      rawGesture: boolean,
      handedness: string
    ) => {
      const history =
        gestureHistory[handedness.toLowerCase() as "left" | "right"];
      history.push(rawGesture);
      if (history.length > HISTORY_LENGTH) {
        history.shift();
      }
      return history.length === HISTORY_LENGTH && history.every(Boolean);
    };

    const AIM_BUFFER_SIZE = 5;
    const aimBuffer = new THREE.Vector3();

    const detectShot = (hand: any, handTracking: any, currentTime: number) => {
      const thumbTip = hand.joints[4].position;
      const indexBase = hand.joints[5].position;
      const relativePos = thumbTip.y - indexBase.y;

      handTracking.thumbHistory.push({ relativePos, time: currentTime });
      if (handTracking.thumbHistory.length > 5) {
        handTracking.thumbHistory.shift();
      }

      if (handTracking.thumbHistory.length < 2) {
        return false;
      }

      const startPos = handTracking.thumbHistory[0].relativePos;
      const startTime = handTracking.thumbHistory[0].time;
      const currentPos =
        handTracking.thumbHistory[handTracking.thumbHistory.length - 1]
          .relativePos;
      const elapsedTime = currentTime - startTime;
      const movement = currentPos - startPos;

      if (handTracking.currentShotState === "READY") {
        if (movement > 0.008) {
          handTracking.currentShotState = "MOVING";
          handTracking.lastStateChange = currentTime;
        }
      } else if (handTracking.currentShotState === "MOVING") {
        if (elapsedTime > 0.6) {
          handTracking.currentShotState = "READY";
          handTracking.lastStateChange = currentTime;
          handTracking.thumbHistory = [];
        } else if (movement > 0.015) {
          const positions = handTracking.thumbHistory.map(
            (entry: any) => entry.relativePos
          );
          const movements = positions
            .slice(1)
            .map((pos: number, i: number) => pos - positions[i]);
          const isConsistent =
            movements.filter((m: number) => m > 0).length >=
            movements.length * 0.7;

          if (isConsistent) {
            handTracking.currentShotState = "SHOT";
            handTracking.lastSuccessfulShot = currentTime;
            handTracking.lastStateChange = currentTime;
            handTracking.thumbHistory = [];
            return true;
          }
        }
      } else if (handTracking.currentShotState === "SHOT") {
        if (currentTime - handTracking.lastSuccessfulShot >= 0.4) {
          handTracking.currentShotState = "READY";
          handTracking.lastStateChange = currentTime;
          handTracking.thumbHistory = [];
        }
      }

      return false;
    };

    hands.onResults((results) => {
      if (results.multiHandLandmarks && results.multiHandedness) {
        leftHand.group.visible = false;
        rightHand.group.visible = false;

        results.multiHandLandmarks.forEach((landmarks, index) => {
          const handedness = results.multiHandedness[index].label;
          const hand = handedness === "Left" ? leftHand : rightHand;
          const tracking =
            handedness === "Left" ? handTracking.left : handTracking.right;
          hand.group.visible = true;

          const positionSmoothFactor = 0.2;

          const requiredLandmarks = [0, 5, 6, 7, 8];
          const allLandmarksVisible = requiredLandmarks.every(
            (i) => landmarks[i]
          );

          if (!allLandmarksVisible) {
            return;
          }

          landmarks.forEach((landmark, i) => {
            const landmarkPosition = new THREE.Vector3(
              (0.5 - landmark.x) * 4,
              (-landmark.y + 0.5) * 4,
              landmark.z * 4
            );

            landmarkPosition.z = smoothValue(
              hand.jointPositions[i].z || landmarkPosition.z,
              landmarkPosition.z,
              0.1
            );

            smoothPosition(
              hand.jointPositions[i],
              landmarkPosition,
              positionSmoothFactor
            );
            hand.joints[i].position.copy(hand.jointPositions[i]);
          });

          const positions = new Float32Array(HAND_CONNECTIONS.length * 6);
          HAND_CONNECTIONS.forEach((connection, i) => {
            const start = hand.joints[connection[0]].position;
            const end = hand.joints[connection[1]].position;
            positions[i * 6] = start.x;
            positions[i * 6 + 1] = start.y;
            positions[i * 6 + 2] = start.z;
            positions[i * 6 + 3] = end.x;
            positions[i * 6 + 4] = end.y;
            positions[i * 6 + 5] = end.z;
          });
          hand.lines.geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
          );

          const handPosition = new THREE.Vector3().copy(camera.position);
          handPosition.add(
            camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(2)
          );
          clampToRoom(handPosition);
          smoothPosition(
            tracking.currentPosition,
            handPosition,
            tracking.positionSmoothing
          );
          hand.group.position.copy(tracking.currentPosition);

          const handRotation = camera.quaternion.clone();
          hand.group.quaternion.slerp(handRotation, tracking.rotationSmoothing);

          const rawGesture = isFingerGunGesture(hand.joints);
          const isGunGesture = smoothGestureDetection(rawGesture, handedness);
          const currentTime = performance.now() / 1000; // Convert to seconds

          const color = isGunGesture
            ? 0xffff00
            : handedness === "Left"
            ? 0x00ff00
            : 0xff0000;

          hand.joints.forEach((joint) => {
            (joint.material as THREE.MeshPhongMaterial).color.setHex(color);
          });
          (hand.lines.material as THREE.LineBasicMaterial).color.setHex(color);

          const indexTipPos = hand.joints[8].position;
          const indexBasePos = hand.joints[5].position;

          const aimDirection = new THREE.Vector3()
            .subVectors(indexTipPos, indexBasePos)
            .normalize()
            .multiplyScalar(1.0);

          aimBuffer.add(aimDirection);

          const averageAimDirection = aimBuffer
            .clone()
            .divideScalar(AIM_BUFFER_SIZE);

          averageAimDirection.normalize().multiplyScalar(1.0);

          aimBuffer.set(0, 0, 0);

          hand.previousAimDirection.lerp(averageAimDirection, 0.7);

          const aimPositions = new Float32Array(6);
          aimPositions[0] = indexTipPos.x;
          aimPositions[1] = indexTipPos.y;
          aimPositions[2] = indexTipPos.z;
          aimPositions[3] = indexTipPos.x + hand.previousAimDirection.x;
          aimPositions[4] = indexTipPos.y + hand.previousAimDirection.y;
          aimPositions[5] = indexTipPos.z + hand.previousAimDirection.z;

          hand.indexAimLine.geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(aimPositions, 3)
          );

          if (isGunGesture) {
            hand.previousAimDirection.copy(averageAimDirection);
            if (detectShot(hand, tracking, currentTime)) {
              const indexTipWorld = new THREE.Vector3();
              indexTipWorld.copy(hand.joints[8].position);
              indexTipWorld.add(hand.group.position);

              shoot(indexTipWorld, hand.previousAimDirection);
            }
          }
        });
      }
    });

    const initializeTracking = async () => {
      try {
        await hands.initialize();
        const webcam = new Camera(videoRef.current!, {
          onFrame: async () => {
            try {
              await hands.send({ image: videoRef.current! });
            } catch (error) {
              console.error("Frame processing error:", error);
            }
          },
          width: 640,
          height: 480,
        });

        await webcam.start();
        setAppState("complete");
      } catch (error) {
        console.error("Initialization error:", error);
      }
    };

    initializeTracking();

    const wallColliders = [
      new THREE.Box3(
        new THREE.Vector3(-roomWidth / 2, -1, -roomDepth / 2),
        new THREE.Vector3(roomWidth / 2, 0.1, roomDepth / 2)
      ),
      new THREE.Box3(
        new THREE.Vector3(-roomWidth / 2, roomHeight - 0.1, -roomDepth / 2),
        new THREE.Vector3(roomWidth / 2, roomHeight + 1, roomDepth / 2)
      ),
      new THREE.Box3(
        new THREE.Vector3(-roomWidth / 2, 0, -roomDepth / 2 - 1),
        new THREE.Vector3(roomWidth / 2, roomHeight, -roomDepth / 2 + 0.1)
      ),
      new THREE.Box3(
        new THREE.Vector3(-roomWidth / 2, 0, roomDepth / 2 - 0.1),
        new THREE.Vector3(roomWidth / 2, roomHeight, roomDepth / 2 + 1)
      ),
      new THREE.Box3(
        new THREE.Vector3(-roomWidth / 2 - 1, 0, -roomDepth / 2),
        new THREE.Vector3(-roomWidth / 2 + 0.1, roomHeight, roomDepth / 2)
      ),
      new THREE.Box3(
        new THREE.Vector3(roomWidth / 2 - 0.1, 0, -roomDepth / 2),
        new THREE.Vector3(roomWidth / 2 + 1, roomHeight, roomDepth / 2)
      ),
    ];

    const PLAYER_RADIUS = 0.5;
    const HAND_MARGIN = 1;

    const checkPlayerCollision = (position: THREE.Vector3): boolean => {
      const playerBox = new THREE.Box3(
        new THREE.Vector3(
          position.x - PLAYER_RADIUS,
          position.y - 1,
          position.z - PLAYER_RADIUS
        ),
        new THREE.Vector3(
          position.x + PLAYER_RADIUS,
          position.y + 0.5,
          position.z + PLAYER_RADIUS
        )
      );

      return wallColliders.some((wall) => wall.intersectsBox(playerBox));
    };

    const clampToRoom = (position: THREE.Vector3): THREE.Vector3 => {
      position.x = Math.max(
        -roomWidth / 2 + HAND_MARGIN,
        Math.min(roomWidth / 2 - HAND_MARGIN, position.x)
      );
      position.y = Math.max(
        HAND_MARGIN,
        Math.min(roomHeight - HAND_MARGIN, position.y)
      );
      position.z = Math.max(
        -roomDepth / 2 + HAND_MARGIN,
        Math.min(roomDepth / 2 - HAND_MARGIN, position.z)
      );
      return position;
    };

    const animate = () => {
      requestAnimationFrame(animate);

      if (controls.isLocked) {
        const forward = new THREE.Vector3(0, 0, -1);
        const right = new THREE.Vector3(1, 0, 0);
        forward.applyQuaternion(camera.quaternion);
        right.applyQuaternion(camera.quaternion);

        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();

        direction.set(0, 0, 0);

        if (moveState.forward) direction.add(forward);
        if (moveState.backward) direction.sub(forward);
        if (moveState.right) direction.add(right);
        if (moveState.left) direction.sub(right);

        direction.normalize();

        velocity.x = direction.x * moveSpeed;
        velocity.z = direction.z * moveSpeed;

        const currentPos = camera.position.clone();
        let newPos = currentPos.clone();

        newPos.x += velocity.x;
        if (!checkPlayerCollision(newPos)) {
          currentPos.x = newPos.x;
        }

        newPos = currentPos.clone();
        newPos.z += velocity.z;
        if (!checkPlayerCollision(newPos)) {
          currentPos.z = newPos.z;
        }

        camera.position.copy(currentPos);
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    const targets: THREE.Mesh[] = [];
    const TARGET_COUNT = 5;
    const TARGET_RESPAWN_TIME = 1000;

    const createTarget = () => {
      const geometry = new THREE.SphereGeometry(0.3);
      const material = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.2,
      });
      const target = new THREE.Mesh(geometry, material);

      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.random() * 10;
      target.position.set(
        Math.sin(angle) * distance,
        1 + Math.random() * 3,
        Math.cos(angle) * distance
      );

      scene.add(target);
      targets.push(target);
      return target;
    };

    for (let i = 0; i < TARGET_COUNT; i++) {
      createTarget();
    }

    const gameTimer = setInterval(() => {
      if (appState === "complete" && isLocked) {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(gameTimer);
            setAppState("gameover");
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      clearInterval(gameTimer);
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      try {
        hands.close();
      } catch (error) {
        console.error("Cleanup error:", error);
      }
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("click", onClick);
    };
  }, [appState]);

  const renderOverlay = () => {
    if (appState === "start") {
      return (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.9)",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <h2>Welcome to the Finger Gun Shooting Game!</h2>
          <p>Please click continue and then allow camera access.</p>
          <button
            onClick={() => setAppState("initializing")}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              margin: "20px",
              cursor: "pointer",
            }}
          >
            Continue
          </button>
        </div>
      );
    }

    if (appState === "initializing") {
      return (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "2rem",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <div
            className="loader"
            style={{
              width: "50px",
              height: "50px",
              border: "5px solid #f3f3f3",
              borderTop: "5px solid #3498db",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 20px",
            }}
          />
          <h2>Initializing...</h2>
        </div>
      );
    }

    if (appState === "gameover") {
      return (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "2rem",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <h2>Game Over!</h2>
          <p>Final Score: {score}</p>
          <button
            onClick={() => {
              setScore(0);
              setTimeLeft(60);
              setAppState("complete");
            }}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              margin: "20px",
              cursor: "pointer",
            }}
          >
            Play Again
          </button>
        </div>
      );
    }

    if (appState === "complete" && isLocked) {
      return (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            textShadow: "2px 2px 2px black",
          }}
        >
          <div>Score: {score}</div>
          <div>Time: {timeLeft}s</div>
        </div>
      );
    }

    if (!isLocked && appState === "complete") {
      return (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "white",
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: "20px",
            borderRadius: "5px",
          }}
        >
          Click to play
          <br />
          (WASD = Move, Mouse = Look)
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
      <video
        ref={videoRef}
        style={{
          position: "absolute",
          width: "160px",
          height: "120px",
          bottom: 10,
          right: 10,
          zIndex: 1,
          display: appState === "complete" ? "block" : "none",
        }}
      />
      {renderOverlay()}
    </>
  );
}

export default App;
