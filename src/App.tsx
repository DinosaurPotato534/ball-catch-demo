import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import "./App.css";

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [calibrationState, setCalibrationState] = useState<
    | "initial"
    | "loading-mediapipe"
    | "positioning"
    | "loading-calibration"
    | "scene-initializing"
    | "complete"
  >("initial");
  const calibrationDataRef = useRef<{
    initialHandHeight: number | null;
    initialHandPosition: THREE.Vector3 | null;
  }>({ initialHandHeight: null, initialHandPosition: null });
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!mountRef.current || !videoRef.current) return;

    // Scene setup
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

      return { group, lines, joints, jointPositions };
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
      },
      right: {
        velocity: new THREE.Vector3(),
        lastPosition: new THREE.Vector3(),
        targetPosition: new THREE.Vector3(),
        currentPosition: new THREE.Vector3(),
        smoothVelocity: new THREE.Vector3(),
      },
    };

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    let firstFrameProcessed = false;

    hands.onResults((results) => {
      if (!firstFrameProcessed && calibrationState === "loading-mediapipe") {
        firstFrameProcessed = true;
        setCalibrationState("positioning");
      }

      if (results.multiHandLandmarks && results.multiHandedness) {
        leftHand.group.visible = false;
        rightHand.group.visible = false;

        if (
          calibrationState === "positioning" &&
          results.multiHandLandmarks.length === 2
        ) {
          setCalibrationState("loading-calibration");

          const leftHandIndex = results.multiHandedness.findIndex(
            (h) => h.label === "Left"
          );
          const rightHandIndex = results.multiHandedness.findIndex(
            (h) => h.label === "Right"
          );

          if (leftHandIndex !== -1 && rightHandIndex !== -1) {
            setCalibrationState("scene-initializing");
            const leftPalm = results.multiHandLandmarks[leftHandIndex][0];
            const rightPalm = results.multiHandLandmarks[rightHandIndex][0];

            const avgY =
              ((-leftPalm.y + 0.5) * 4 + (-rightPalm.y + 0.5) * 4) / 2;
            const avgZ = (leftPalm.z * 4 + rightPalm.z * 4) / 2;

            calibrationDataRef.current = {
              initialHandHeight: avgY,
              initialHandPosition: new THREE.Vector3(0, avgY, avgZ),
            };

            setTimeout(() => {
              setCalibrationState("complete");
            }, 3000);
          }
        }

        results.multiHandLandmarks.forEach((landmarks, index) => {
          const handedness = results.multiHandedness[index].label;
          const hand = handedness === "Left" ? leftHand : rightHand;
          const tracking =
            handedness === "Left" ? handTracking.left : handTracking.right;
          hand.group.visible = true;

          const smoothFactor = 0.3;

          landmarks.forEach((landmark, i) => {
            const targetPosition = new THREE.Vector3(
              (0.5 - landmark.x) * 4,
              (-landmark.y + 0.5) * 4,
              landmark.z * 4
            );

            hand.jointPositions[i].lerp(targetPosition, smoothFactor);
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

          const targetPosition = new THREE.Vector3().copy(camera.position);
          targetPosition.add(
            camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(2)
          );
          clampToRoom(targetPosition);

          tracking.targetPosition.copy(targetPosition);

          const deltaPosition = new THREE.Vector3().subVectors(
            tracking.targetPosition,
            tracking.currentPosition
          );

          tracking.smoothVelocity.lerp(deltaPosition.multiplyScalar(0.1), 0.1);

          tracking.currentPosition.add(tracking.smoothVelocity);

          hand.group.position.lerp(tracking.currentPosition, 0.1);

          tracking.smoothVelocity.multiplyScalar(0.95);

          tracking.lastPosition.copy(tracking.currentPosition);

          const targetQuaternion = camera.quaternion.clone();
          hand.group.quaternion.slerp(targetQuaternion, smoothFactor);
        });
      }
    });

    const webcam = new Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current! });
      },
      width: 640,
      height: 480,
    });
    webcam.start();

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

    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      hands.close();
      webcam.stop();
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("click", onClick);
    };
  }, [calibrationState]);

  const renderLoadingScreen = () => (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3,
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
          marginBottom: "20px",
        }}
      />
      <h2>
        {calibrationState === "loading-mediapipe"
          ? "Initializing Hand Tracking..."
          : calibrationState === "scene-initializing"
          ? "Initializing Scene..."
          : "Finalizing Calibration..."}
      </h2>
    </div>
  );

  return (
    <>
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }}>
        {!isLocked && (
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
              display: calibrationState === "complete" ? "block" : "none",
            }}
          >
            Click to play
            <br />
            (WASD = Move, Mouse = Look)
          </div>
        )}
      </div>
      <video
        ref={videoRef}
        style={{
          position: "absolute",
          width: "160px",
          height: "120px",
          bottom: 10,
          right: 10,
          zIndex: 1,
        }}
      />
      {(calibrationState === "loading-mediapipe" ||
        calibrationState === "loading-calibration" ||
        calibrationState === "scene-initializing") &&
        renderLoadingScreen()}
      {calibrationState !== "complete" &&
        calibrationState !== "loading-mediapipe" &&
        calibrationState !== "loading-calibration" &&
        calibrationState !== "scene-initializing" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.7)",
              color: "white",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              padding: "20px",
              textAlign: "center",
            }}
          >
            {calibrationState === "initial" ? (
              <>
                <h2>Camera Setup</h2>
                <p>
                  Please ensure your camera is positioned in front of you at a
                  comfortable height.
                </p>
                <button
                  onClick={() => setCalibrationState("loading-mediapipe")}
                  style={{
                    padding: "10px 20px",
                    fontSize: "16px",
                    margin: "20px",
                    cursor: "pointer",
                  }}
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <h2>Hand Position Calibration</h2>
                <p>
                  Hold both hands up with palms facing forward at a comfortable
                  height.
                </p>
                <p>Keep your hands steady until calibration completes...</p>
              </>
            )}
          </div>
        )}
    </>
  );
}

export default App;
