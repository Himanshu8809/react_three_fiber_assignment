import React, { useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Cylinder, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

function Pendulum({ isSwinging, gravityOn, onEnergyUpdate }) {
  const pivot = useRef();
  const sphere = useRef();
  const { camera } = useThree();
  const [isDragging, setIsDragging] = useState(true);
  const [isClickedDown, setIsClickedDown] = useState(false);
  const [angle, setAngle] = useState(Math.PI / 2); // Initial angle (90 degrees)
  const [velocity, setVelocity] = useState(0);
  const [amplitude, setAmplitude] = useState(Math.PI / 2); // Initial amplitude
  const [lastGravityOn, setLastGravityOn] = useState(true); // Track the last gravity state
  const length = 2;

  const calculateAngleFromMouse = (event) => {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    const pivotPosition = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3().subVectors(intersectPoint, pivotPosition).normalize();
    const newAngle = Math.atan2(direction.y, direction.x);
    return newAngle;
  };

  const handlePointerDown = (event) => {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    const distanceToSphere = intersectPoint.distanceTo(sphere.current.position);
    if (distanceToSphere < 0.5) { // Check if click is near the sphere
      setIsDragging(true);
      setIsClickedDown(true);
      const newAngle = calculateAngleFromMouse(event);
      setAngle(newAngle);
      setVelocity(0);
      setAmplitude(Math.abs(newAngle)); // Update amplitude when dragging
    }
  };

  const handlePointerMove = (event) => {
    if (isDragging && isClickedDown) {
      const newAngle = calculateAngleFromMouse(event);
      setAngle(newAngle + Math.PI / 2);
      pivot.current.rotation.z = newAngle + Math.PI / 2;
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsClickedDown(false);
  };

  useFrame(() => {
    // Detect when gravity state changes from on to off
    if (lastGravityOn !== gravityOn && !gravityOn) {
      // Store the last angle as amplitude when gravity turns off
      setAmplitude(angle);
    }

    // Update lastGravityOn to current gravityOn
    setLastGravityOn(gravityOn);

    if (isSwinging && !isDragging) {
      if (gravityOn) {
        // Gravity is on, pendulum with damping
        setAngle((prevAngle) => {
          const acceleration = -0.001 * Math.sin(prevAngle);
          let newVelocity = velocity + acceleration;
          newVelocity *= 0.999; // Damping factor
          const newAngle = prevAngle + newVelocity;
          pivot.current.rotation.z = newAngle;
          setVelocity(newVelocity);

          const kineticEnergy = 0.5 * Math.pow(length * newVelocity, 2);
          const potentialEnergy = 0.001 * length * (1 - Math.cos(newAngle));
          const mechanicalEnergy = kineticEnergy + potentialEnergy;

          onEnergyUpdate({
            kineticEnergy,
            potentialEnergy,
            mechanicalEnergy,
          });

          return newAngle;
        });
      } else {
        // Gravity is off, pendulum swings back and forth based on last amplitude
        setAngle((prevAngle) => {
          const newAngle = amplitude * Math.sin(Date.now() * 0.002); // Using time for smooth oscillation
          pivot.current.rotation.z = newAngle;
          return newAngle;
        });
      }
    }
  });

  return (
    <>
      <group ref={pivot}>
        <Cylinder args={[0.05, 0.05, length, 32]} position={[0, -length / 2, 0]} />
        <Sphere
          ref={sphere}
          args={[0.2, 32, 32]}
          position={[0, -length, 0]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </group>
      {/* Fixed Angle Scale */}
      <AngleScale length={length} />
    </>
  );
}

function AngleScale({ length }) {
  const angles = [Math.PI / 2, Math.PI / 4, 0, -Math.PI / 4, -Math.PI / 2]; // 90, 45, 0, -45, -90 degrees
  const radius = length + 0.5; // Radius of the scale

  return (
    <group position={[0, 0, 0]} rotation={[0, 0 , -Math.PI / 2 ]} >
      {angles.map((angle, index) => (
        <Text
          key={index}
          position={[
            radius * Math.cos(angle),
            radius * Math.sin(angle),
            0,
          ]}
          fontSize={0.2}
          color="white"
          rotation={[0, 0, (angle < 0 ? -angle :(  angle == 0 ? Math.PI / 2 : angle))]}
        >
          {(angle * (180 / Math.PI)).toFixed(0) + '°'}
        </Text>
      ))}
    </group>
  );
}

export default function PendulumScene() {
  const [isSwinging, setIsSwinging] = useState(true);
  const [gravityOn, setGravityOn] = useState(false);
  const [energyData, setEnergyData] = useState({
    mechanicalEnergy: [],
    potentialEnergy: [],
    kineticEnergy: [],
    time: [],
  });

  const toggleSwinging = () => {
    setIsSwinging((prevState) => !prevState);
  };

  const toggleGravity = () => {
    setGravityOn((prevState) => !prevState);
  };

  const handleEnergyUpdate = (energy) => {
    setEnergyData((prevState) => {
      const time = prevState.time.length ? prevState.time[prevState.time.length - 1] + 1 : 0;
      return {
        mechanicalEnergy: [...prevState.mechanicalEnergy, energy.mechanicalEnergy],
        potentialEnergy: [...prevState.potentialEnergy, energy.potentialEnergy],
        kineticEnergy: [...prevState.kineticEnergy, energy.kineticEnergy],
        time: [...prevState.time, time],
      };
    });
  };

  const latestEnergy = {
    mechanicalEnergy: energyData.mechanicalEnergy.slice(-1)[0] || 0,
    potentialEnergy: energyData.potentialEnergy.slice(-1)[0] || 0,
    kineticEnergy: energyData.kineticEnergy.slice(-1)[0] || 0,
  };

  const energyChartData = {
    labels: ['Mechanical Energy', 'Potential Energy', 'Kinetic Energy'],
    datasets: [
      {
        data: [latestEnergy.mechanicalEnergy, latestEnergy.potentialEnergy, latestEnergy.kineticEnergy],
        backgroundColor: ['red', 'green', 'blue'],
        borderColor: ['red', 'green', 'blue'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <>
      <Canvas
        style={{ background: 'black', height: '100vh', width: '100vw' }}
        camera={{ position: [0, 2, 5], fov: 50 }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 2, 2]} />
        <Pendulum isSwinging={isSwinging} gravityOn={gravityOn} onEnergyUpdate={handleEnergyUpdate} />
      </Canvas>
      <div style={{ position: 'absolute', top: 20, left: 20 }}>
        <button onClick={toggleSwinging}>
          {isSwinging ? 'Stop Swinging' : 'Start Swinging'}
        </button>
        <button onClick={toggleGravity}>
          {gravityOn ? 'Turn Gravity Off' : 'Turn Gravity On'}
        </button>
      </div>
      <div style={{ position: 'absolute', bottom: 25, left: 0, width: '27%' }}>
        <Pie data={energyChartData} />
      </div>
    </>
  );
}
