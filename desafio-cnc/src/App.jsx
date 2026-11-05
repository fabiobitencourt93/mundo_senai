import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

const HEADER_GCODE = `O0001 (REGUA CILINDRICA)
N10 G17 G21 G40 G80 G90
N20 (FERRAMENTA DE ACABAMENTO)
N30 G53 X0
N40 G53 Z0
N50 T0101 (DCMT SDJCR RETA)
N60 G54
N70 G92 S250
N80 G96 S3000 M4
N90 (TORNEAMENTO PERFIL)
N100 G00 Z2.
N110 G00 X10.
N120 G01 Z0.
; --- INSIRA AS COORDENADAS ABAIXO ---`;

const INITIAL_USER_GCODE = `G01 X12. Z-1.
G01 Z-13.
G01 X17.
G01 Z-19.
G01 X21.`;

const FOOTER_GCODE = `; ------------------------------------
N180 G00 G53 X0.
N190 G00 G53 Z0.
N200 M5
N210 M30`;

// --- SISTEMAS DE PARTÍCULAS E CÂMARA ---

function CameraController({ view }) {
  const { camera, controls } = useThree();
  
  const targetPos = useRef(new THREE.Vector3(25, 35, 30));
  const targetLook = useRef(new THREE.Vector3(5, 0, -5));

  useEffect(() => {
    if (view === 'ISO') {
      targetPos.current.set(25, 35, 30);
      targetLook.current.set(5, 0, -5);
    } else if (view === 'TOP') {
      targetPos.current.set(5, 55, -5);
      targetLook.current.set(5, 0, -5);
    }
  }, [view]);

  useFrame((state, delta) => {
    camera.position.lerp(targetPos.current, 5 * delta);
    if (controls) {
      controls.target.lerp(targetLook.current, 5 * delta);
      controls.update();
    }
  });

  return null;
}

function Confetti() {
  const count = 200;
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const particles = useMemo(() => {
    const temp = [];
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    for (let i = 0; i < count; i++) {
      temp.push({
        pos: new THREE.Vector3((Math.random() - 0.5) * 60, 30 + Math.random() * 40, (Math.random() - 0.5) * 60),
        vel: new THREE.Vector3((Math.random() - 0.5) * 10, -15 - Math.random() * 20, (Math.random() - 0.5) * 10),
        rot: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotSpeed: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        color: new THREE.Color(colors[Math.floor(Math.random() * colors.length)])
      });
    }
    return temp;
  }, []);

  useEffect(() => {
    if (meshRef.current) {
      particles.forEach((p, i) => meshRef.current.setColorAt(i, p.color));
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [particles]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      p.pos.addScaledVector(p.vel, delta);
      p.rot.addScaledVector(p.rotSpeed, delta);
      if (p.pos.y < -20) {
        p.pos.y = 40 + Math.random() * 20;
        p.pos.x = (Math.random() - 0.5) * 60;
        p.pos.z = (Math.random() - 0.5) * 60;
      }
      dummy.position.copy(p.pos);
      dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Explosion({ position }) {
  const fireballRef = useRef();
  const lightRef = useRef();
  const debrisRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 80;

  const debris = useMemo(() => {
    const temp = [];
    for(let i = 0; i < count; i++) {
       temp.push({
          pos: new THREE.Vector3(0, 0, 0),
          vel: new THREE.Vector3((Math.random() - 0.5) * 150, Math.random() * 150, (Math.random() - 0.5) * 150),
          rot: new THREE.Vector3(Math.random(), Math.random(), Math.random()),
          rotVel: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20)
       });
    }
    return temp;
  }, []);

  useFrame((state, delta) => {
    if (fireballRef.current && fireballRef.current.visible) {
       fireballRef.current.scale.addScalar(delta * 150); 
       fireballRef.current.material.opacity -= delta * 1.5;
       if (fireballRef.current.material.opacity <= 0) fireballRef.current.visible = false;
    }
    
    if (lightRef.current && lightRef.current.intensity > 0) {
       lightRef.current.intensity -= delta * 300; 
    }

    if (debrisRef.current) {
       debris.forEach((p, i) => {
          p.vel.y -= 250 * delta; 
          p.pos.addScaledVector(p.vel, delta);
          p.rot.addScaledVector(p.rotVel, delta);
          dummy.position.copy(p.pos);
          dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
          dummy.updateMatrix();
          debrisRef.current.setMatrixAt(i, dummy.matrix);
       });
       debrisRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
       <pointLight ref={lightRef} color="#ff5500" intensity={300} distance={150} />
       <mesh ref={fireballRef}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color="#ff4400" transparent opacity={1} />
       </mesh>
       <instancedMesh ref={debrisRef} args={[null, null, count]}>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
       </instancedMesh>
    </group>
  );
}

// Componente da Placa Universal
function Placa3Castanhas({ zOffset }) {
  return (
    <group position={[0, 0, zOffset]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[22, 22, 12, 64]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -8]}>
        <cylinderGeometry args={[14, 14, 4, 64]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.5} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 6.01]}>
        <circleGeometry args={[6, 32]} />
        <meshBasicMaterial color="#050505" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
          <mesh position={[0, 15, 6]}>
            <boxGeometry args={[7, 14, 12]} />
            <meshStandardMaterial color="#1f1f1f" metalness={0.6} roughness={0.7} />
          </mesh>
          <mesh position={[0, 12, 8]}>
            <boxGeometry args={[7, 6, 8]} />
            <meshStandardMaterial color="#292929" metalness={0.6} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Simulador CNC Principal
function CNCMachine({ path, simState, onFinish, onCollision, workpieceColor, toolSetup, stockSetup }) {
  const toolGroupRef = useRef();
  const workpieceMeshRef = useRef();
  const rotGroupRef = useRef();
  const chipRef = useRef();
  const chipTimer = useRef(0);
  
  const animState = useRef({ index: 0, t: 0 });
  const prevToolPos = useRef({ r: 5, z: 2 });
  
  const radius = stockSetup.diameter / 2;
  const length = stockSetup.length;

  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(radius, radius, length, 128, 256);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -length / 2);
    return geo;
  }, [radius, length]);

  const originalPositions = useMemo(() => new Float32Array(geometry.attributes.position.array), [geometry]);
  const currentRadii = useRef(new Float32Array(originalPositions.length / 3).fill(radius));

  useEffect(() => {
    currentRadii.current = new Float32Array(originalPositions.length / 3).fill(radius);
  }, [originalPositions, radius]);

  useEffect(() => {
    if (simState === 'PLAYING' || simState === 'IDLE') {
      if (simState === 'PLAYING' && path.length > 0) {
        animState.current = { index: 0, t: 0 };
        const startR = path[0].x / 2;
        prevToolPos.current = { r: startR, z: path[0].z };
        chipTimer.current = 0;
        
        if (toolGroupRef.current) {
          toolGroupRef.current.position.set(startR, 0, path[0].z);
        }
      }
      
      if (simState === 'IDLE' && toolGroupRef.current) {
        toolGroupRef.current.position.set(15, 0, 5); 
      }

      currentRadii.current.fill(radius);
      const positions = workpieceMeshRef.current.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i++) {
         positions[i] = originalPositions[i];
      }
      workpieceMeshRef.current.geometry.attributes.position.needsUpdate = true;
      workpieceMeshRef.current.geometry.computeVertexNormals();
    }
  }, [simState, path, originalPositions, radius]);

  useFrame((state, delta) => {
    if (simState === 'PLAYING') {
      if (rotGroupRef.current) {
        rotGroupRef.current.rotation.z -= 30 * delta; 
      }
      
      if (chipRef.current) {
        chipTimer.current += delta * 6;
        const tCycle = chipTimer.current % 1;
        
        chipRef.current.position.set(
            -tCycle * 4, 
            1 + tCycle * 8,      
            tCycle * 6       
        );
        chipRef.current.rotation.x += 25 * delta;
        chipRef.current.rotation.y += 20 * delta;
        const s = 1 - (tCycle * tCycle); 
        chipRef.current.scale.set(s, s, s);
      }
    }

    if (simState !== 'PLAYING' || path.length < 2) return;
    
    let { index, t } = animState.current;
    if (index >= path.length - 1) return;

    const p1 = path[index];
    const p2 = path[index + 1]; 
    
    const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const speed = p2.type === 'G00' ? 40 : 12; 
    const step = dist > 0 ? (speed * delta) / dist : 1;
    
    t += step;
    let reachedEnd = false;
    if (t >= 1) {
       t = 1;
       reachedEnd = true;
    }
    
    const currentDia = p1.x + (p2.x - p1.x) * t;
    const cz = p1.z + (p2.z - p1.z) * t;
    const currentR = currentDia / 2;

    if (toolGroupRef.current) {
        toolGroupRef.current.position.set(currentR, 0, cz);
    }

    if (currentR < 0 || cz < -length + 5.5) {
        onCollision('CRASH_CHUCK', currentR, cz);
        return;
    }

    const pr = prevToolPos.current.r;
    const pz = prevToolPos.current.z;
    
    const positions = workpieceMeshRef.current.geometry.attributes.position.array;
    let needsUpdate = false;
    const margin = 0.2; 
    const zMin = Math.min(pz, cz) - margin;
    const zMax = Math.max(pz, cz) + margin;
    
    for (let i = 0; i < positions.length; i += 3) {
        const origX = originalPositions[i];
        const origY = originalPositions[i+1];
        const z = originalPositions[i+2];
        
        if (z >= zMin && z <= zMax) {
            let r_cut = currentRadii.current[i/3];
            
            if (Math.abs(cz - pz) < 1e-5) {
                if (Math.abs(z - cz) <= margin) r_cut = Math.min(r_cut, currentR);
            } else {
                const tz = (z - pz) / (cz - pz);
                if (tz >= 0 && tz <= 1) {
                    const interpR = pr + tz * (currentR - pr);
                    r_cut = Math.min(r_cut, interpR);
                } else if (tz > -0.1 && tz < 0) {
                    r_cut = Math.min(r_cut, pr);
                } else if (tz > 1 && tz < 1.1) {
                    r_cut = Math.min(r_cut, currentR);
                }
            }
            
            if (r_cut < currentRadii.current[i/3] - 0.005) {
                if (p2.type === 'G00') {
                    onCollision('CRASH_G00', currentR, cz); 
                    return; 
                }

                currentRadii.current[i/3] = r_cut;
                const origR = Math.sqrt(origX*origX + origY*origY);
                if (origR > 0) {
                    const finalR = Math.max(0, Math.min(r_cut, origR));
                    const scale = finalR / origR;
                    positions[i] = origX * scale;
                    positions[i+1] = origY * scale;
                    needsUpdate = true;
                }
            }
        }
    }
    
    if (needsUpdate) {
        workpieceMeshRef.current.geometry.attributes.position.needsUpdate = true;
        workpieceMeshRef.current.geometry.computeVertexNormals();
    }
    
    prevToolPos.current = { r: currentR, z: cz };

    if (reachedEnd) {
        animState.current = { index: index + 1, t: 0 };
        if (index + 1 >= path.length - 1) {
            onFinish();
        }
    } else {
        animState.current = { index, t };
    }
  });

  return (
    <group>
        <group ref={rotGroupRef}>
            <Placa3Castanhas zOffset={-length} />
            <mesh ref={workpieceMeshRef} geometry={geometry}>
                <meshStandardMaterial color={simState === 'COLLISION' ? '#111' : workpieceColor} metalness={0.6} roughness={0.3} />
            </mesh>
        </group>

        {/* --- CONJUNTO DA FERRAMENTA MELHORADA ESTETICAMENTE --- */}
        <group ref={toolGroupRef} position={[15, 0, 5]}>
            
            {/* Bloco do Suporte (Shank) - Movido para Y=-8.4 para a pastilha e calço ficarem totalmente à mostra no topo */}
            <mesh position={[toolSetup.supportLength / 2 + toolSetup.supportPosX, -8.4, toolSetup.supportWidth / 2 + toolSetup.supportPosZ]}>
                <boxGeometry args={[toolSetup.supportLength, 14, toolSetup.supportWidth]} />
                <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.4} />
            </mesh>

            {/* Grupo da Pastilha */}
            <group position={[0, 0, 0]} rotation={[0, toolSetup.insertAngle * (Math.PI / 180), 0]}>
                
                {/* Pastilha Dourada (Insert TiN Coating) - Espessura de 2 (Y=-1 a Y=1) */}
                <mesh position={[toolSetup.insertSize, 0, 0]} scale={[toolSetup.insertSize, 2, toolSetup.insertSize * 0.52]}>
                    <cylinderGeometry args={[1, 1, 1, 4]} />
                    <meshStandardMaterial color="#ffd700" metalness={0.6} roughness={0.2} />
                </mesh>

                {/* Calço Metálico (Shim) sob a pastilha */}
                <mesh position={[toolSetup.insertSize, -1.2, 0]} scale={[toolSetup.insertSize * 1.05, 0.4, toolSetup.insertSize * 0.55]}>
                    <cylinderGeometry args={[1, 1, 1, 4]} />
                    <meshStandardMaterial color="#555" metalness={0.7} roughness={0.5} />
                </mesh>
                
                {/* Furo Central Escuro (ilusão de profundidade do parafuso) */}
                <mesh position={[toolSetup.insertSize, 0.01, 0]}>
                    <cylinderGeometry args={[toolSetup.insertSize * 0.3, toolSetup.insertSize * 0.3, 2.02, 16]} />
                    <meshBasicMaterial color="#050505" />
                </mesh>

                {/* Cabeça do Parafuso de Fixação Torx/Hex */}
                <mesh position={[toolSetup.insertSize, 1.2, 0]}>
                    <cylinderGeometry args={[toolSetup.insertSize * 0.4, toolSetup.insertSize * 0.3, 0.6, 16]} />
                    <meshStandardMaterial color="#222" metalness={0.9} roughness={0.3} />
                </mesh>
                <mesh position={[toolSetup.insertSize, 1.51, 0]}>
                    <cylinderGeometry args={[toolSetup.insertSize * 0.2, toolSetup.insertSize * 0.2, 0.1, 6]} />
                    <meshBasicMaterial color="#000" />
                </mesh>
            </group>

            {simState === 'PLAYING' && path[animState.current.index + 1]?.type === 'G01' && (
                <mesh ref={chipRef}>
                    <torusGeometry args={[0.8, 0.15, 8, 12, Math.PI * 1.5]} />
                    <meshStandardMaterial color={workpieceColor} metalness={0.9} roughness={0.1} />
                </mesh>
            )}
        </group>
    </group>
  );
}

export default function App() {
  const [userGcode, setUserGcode] = useState(INITIAL_USER_GCODE);
  const [status, setStatus] = useState('AGUARDANDO...');
  const [path, setPath] = useState([]);
  const [simState, setSimState] = useState('IDLE'); 
  const [collisionType, setCollisionType] = useState(null);
  const [crashPos, setCrashPos] = useState([0, 0, 0]); 
  const [cameraView, setCameraView] = useState('ISO'); 
  
  const [workpieceColor, setWorkpieceColor] = useState('#c0c8d0');
  const [bgColor, setBgColor] = useState('#17171e'); 
  const [showGrid, setShowGrid] = useState(true); 

  const [stockSetup, setStockSetup] = useState({ diameter: 21, length: 25 });
  const [toolSetup, setToolSetup] = useState({ supportWidth: 16, supportLength: 80, insertSize: 8, insertAngle: -30, supportPosX: 8, supportPosZ: 0 });

  const isVictory = simState === 'FINISHED' && status.includes('PARABÉNS');

  const handleStockChange = (param, value) => {
    setStockSetup(prev => ({ ...prev, [param]: parseFloat(value) }));
    handleRestart(); 
  };

  const handleToolChange = (param, value) => {
    setToolSetup(prev => ({ ...prev, [param]: parseFloat(value) }));
  };

  const simularUsinagem = () => {
    setStatus('SIMULANDO...');
    setSimState('IDLE');
    setCollisionType(null);
    setCrashPos([0, 0, 0]);
    
    const fullGcode = `${HEADER_GCODE}\n${userGcode}\n${FOOTER_GCODE}`;
    const linhas = fullGcode.split('\n');
    let currentX = 25; 
    let currentZ = 5;  
    let currentMode = 'G00';
    
    const newPath = [{ x: currentX, z: currentZ, type: currentMode }];

    linhas.forEach(linha => {
      const upperLine = linha.toUpperCase();
      if (upperLine.includes('G53')) return; 
      
      let isMove = false;
      
      if (upperLine.includes('G00') || upperLine.includes('G0 ')) { currentMode = 'G00'; isMove = true; }
      if (upperLine.includes('G01') || upperLine.includes('G1 ')) { currentMode = 'G01'; isMove = true; }
      
      const matchX = upperLine.match(/X([-\d.]+)/);
      const matchZ = upperLine.match(/Z([-\d.]+)/);
      
      if (matchX || matchZ) {
        if (matchX) currentX = parseFloat(matchX[1]);
        if (matchZ) currentZ = parseFloat(matchZ[1]);
        isMove = true;
      }

      if (isMove && (matchX || matchZ)) {
        newPath.push({ x: currentX, z: currentZ, type: currentMode });
      }
    });

    setPath(newPath);
    setTimeout(() => setSimState('PLAYING'), 100);
  };

  const handleRestart = () => {
    setSimState('IDLE');
    setPath([]);
    setCollisionType(null);
    setStatus('AGUARDANDO...');
  };

  const handleFinish = () => {
    setSimState('FINISHED');
    const hasChamfer = path.some(p => p.x === 12 && p.z === -1);
    const hasBody = path.some(p => p.x === 12 && p.z === -13);
    const hasFlange = path.some(p => p.x === 17 && p.z === -19);
    
    if (hasChamfer && hasBody && hasFlange) {
      setStatus('PARABÉNS! PERFIL CILÍNDRICO CONCLUÍDO COM SUCESSO.');
    } else {
      setStatus('PERFIL INCORRETO. VERIFIQUE AS COORDENADAS.');
    }
  };

  const handleCollision = (reason, crashX, crashZ) => {
    setSimState('COLLISION');
    setCollisionType(reason);
    setCrashPos([crashX, 0, crashZ]); 
    if (reason === 'CRASH_G00') {
      setStatus('GAME OVER: COLISÃO (AVANÇO G0 NA PEÇA)!');
    } else {
      setStatus('GAME OVER: COLISÃO (PLACA / LINHA DE CENTRO)!');
    }
  };

  const materials = [
    { name: 'Aço/Alumínio', hex: '#c0c8d0' },
    { name: 'Latão/Ouro', hex: '#d4af37' },
    { name: 'Cobre/Bronze', hex: '#b87333' },
    { name: 'Nylon Preto', hex: '#111111' },
    { name: 'Nylon Azul', hex: '#1e90ff' }
  ];

  const backgrounds = [
    { name: 'Escuro Padrão', hex: '#17171e' },
    { name: 'Cinza Industrial', hex: '#5a5a66' },
    { name: 'Azul Claro', hex: '#8ca1b3' },
    { name: 'Branco', hex: '#ffffff' }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#1e1e1e', color: '#fff', fontFamily: 'monospace' }}>
      
      {/* Sidebar com overflowY para rolagem */}
      <div style={{ width: '35%', padding: '20px', backgroundColor: '#2d2d2d', borderRight: '4px solid #444', display: 'flex', flexDirection: 'column', zIndex: 10, overflowY: 'auto' }}>
        <h2 style={{ color: '#e0c020', marginBottom: '10px', fontSize: '1.2rem', flexShrink: 0 }}>DESAFIO CNC - MUNDO SENAI</h2>
        <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '20px', flexShrink: 0 }}>Complete as coordenadas de perfil (G01) para a Régua Cilíndrica.</p>
        
        {/* Bloco do Editor G-Code com flexShrink: 0 para impedir deformação */}
        <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#161616', border: '1px solid #555', padding: '10px', flexShrink: 0 }}>
          <pre style={{ margin: 0, color: '#666', fontSize: '14px', whiteSpace: 'pre-wrap', pointerEvents: 'none' }}>
            {HEADER_GCODE}
          </pre>
          
          <textarea 
            value={userGcode}
            onChange={(e) => setUserGcode(e.target.value)}
            style={{
              width: '100%', minHeight: '150px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#569cd6',
              border: '1px dashed #666', outline: 'none', resize: 'vertical', fontFamily: 'monospace', fontSize: '14px', margin: '5px 0', padding: '10px'
            }}
          />

          <pre style={{ margin: 0, color: '#666', fontSize: '14px', whiteSpace: 'pre-wrap', pointerEvents: 'none' }}>
            {FOOTER_GCODE}
          </pre>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexShrink: 0 }}>
          <button onClick={simularUsinagem} style={{ flex: 1, padding: '15px', backgroundColor: '#007acc', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
            INICIAR CICLO
          </button>
          <button onClick={handleRestart} style={{ padding: '15px 25px', backgroundColor: '#cc3300', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
            RESTART
          </button>
        </div>

        {/* CONTROLO DA CÂMARA */}
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#1e1e1e', border: '1px solid #444', flexShrink: 0 }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>ÂNGULO DA CÂMARA:</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setCameraView('ISO')} 
              style={{ flex: 1, padding: '10px', backgroundColor: cameraView === 'ISO' ? '#007acc' : '#333', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', borderRadius: '4px' }}
            >
              ISOMÉTRICA
            </button>
            <button 
              onClick={() => setCameraView('TOP')} 
              style={{ flex: 1, padding: '10px', backgroundColor: cameraView === 'TOP' ? '#007acc' : '#333', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', borderRadius: '4px' }}
            >
              VISTA SUPERIOR
            </button>
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#161616', border: '1px solid #444', flexShrink: 0, borderLeft: '4px solid #00ccff' }}>
          <span style={{ color: '#00ccff', fontSize: '12px', display: 'block', marginBottom: '15px', fontWeight: 'bold' }}>MATERIAL BRUTO (STOCK):</span>
          
          <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>DIÂMETRO (EIXO X):</span> <span>{stockSetup.diameter} mm</span>
          </label>
          <input type="range" min="10" max="40" step="1" value={stockSetup.diameter} onChange={(e) => handleStockChange('diameter', e.target.value)} style={{ width: '100%', marginBottom: '12px' }} />

          <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>COMPRIMENTO (EIXO Z):</span> <span>{stockSetup.length} mm</span>
          </label>
          <input type="range" min="15" max="60" step="1" value={stockSetup.length} onChange={(e) => handleStockChange('length', e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#1e1e1e', border: '1px solid #444', flexShrink: 0 }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '15px', fontWeight: 'bold' }}>GEOMETRIA DA FERRAMENTA:</span>
          
          <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>LARGURA:</span> <span>{toolSetup.supportWidth} mm</span>
          </label>
          <input type="range" min="8" max="32" step="1" value={toolSetup.supportWidth} onChange={(e) => handleToolChange('supportWidth', e.target.value)} style={{ width: '100%', marginBottom: '12px' }} />

          <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>COMPRIMENTO:</span> <span>{toolSetup.supportLength} mm</span>
          </label>
          <input type="range" min="40" max="150" step="5" value={toolSetup.supportLength} onChange={(e) => handleToolChange('supportLength', e.target.value)} style={{ width: '100%', marginBottom: '12px' }} />

          <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>TAMANHO (ESCALA):</span> <span>{toolSetup.insertSize}</span>
          </label>
          <input type="range" min="4" max="15" step="0.5" value={toolSetup.insertSize} onChange={(e) => handleToolChange('insertSize', e.target.value)} style={{ width: '100%', marginBottom: '12px' }} />

          <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>ÂNGULO:</span> <span>{toolSetup.insertAngle}°</span>
          </label>
          <input type="range" min="-90" max="90" step="1" value={toolSetup.insertAngle} onChange={(e) => handleToolChange('insertAngle', e.target.value)} style={{ width: '100%', marginBottom: '12px' }} />

          <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>EIXO X:</span> <span>{toolSetup.supportPosX} mm</span>
          </label>
          <input type="range" min="-5" max="25" step="0.5" value={toolSetup.supportPosX} onChange={(e) => handleToolChange('supportPosX', e.target.value)} style={{ width: '100%', marginBottom: '12px' }} />

          <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>EIXO Z:</span> <span>{toolSetup.supportPosZ} mm</span>
          </label>
          <input type="range" min="-15" max="15" step="0.5" value={toolSetup.supportPosZ} onChange={(e) => handleToolChange('supportPosZ', e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#1e1e1e', border: '1px solid #444', flexShrink: 0 }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>MATERIAL DA PEÇA:</span>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
            {materials.map((mat) => (
              <div 
                key={mat.hex} onClick={() => setWorkpieceColor(mat.hex)} title={mat.name}
                style={{ width: '35px', height: '35px', backgroundColor: mat.hex, borderRadius: '50%', cursor: 'pointer', border: workpieceColor === mat.hex ? '3px solid white' : '3px solid transparent', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1e1e1e', border: '1px solid #444', flexShrink: 0 }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>CENÁRIO / FUNDO:</span>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginBottom: '15px' }}>
            {backgrounds.map((bg) => (
              <div 
                key={bg.hex} onClick={() => setBgColor(bg.hex)} title={bg.name}
                style={{ width: '35px', height: '35px', backgroundColor: bg.hex, borderRadius: '4px', cursor: 'pointer', border: bgColor === bg.hex ? '3px solid #00ccff' : '3px solid #555' }}
              />
            ))}
          </div>
          <button onClick={() => setBgColor('hdri')} style={{ width: '100%', padding: '10px', backgroundColor: bgColor === 'hdri' ? '#007acc' : '#333', color: 'white', border: '1px solid #555', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', borderRadius: '4px' }}>
            🏭 ATIVAR AMBIENTE FABRIL 3D
          </button>
        </div>
        
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1e1e1e', border: '1px solid #444', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>EXIBIR GRADE (GRID):</span>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
        </div>

        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: simState === 'COLLISION' ? '#a00' : (status.includes('PARABÉNS') ? '#0a0' : '#444'), textAlign: 'center', fontWeight: 'bold', flexShrink: 0, marginBottom: '20px' }}>
          {status}
        </div>
      </div>

      {/* Viewport 3D */}
      <div style={{ width: '65%', position: 'relative', backgroundColor: bgColor !== 'hdri' ? bgColor : '#111' }}>
        <Canvas fov={45}>
          <CameraController view={cameraView} />

          {bgColor !== 'hdri' && <color attach="background" args={[bgColor]} />}
          
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={1.5} />
          <directionalLight position={[-10, 5, 5]} intensity={0.5} />
          {showGrid && <gridHelper args={[100, 25, '#444', '#222']} position={[0, -15, 0]} />}

          <CNCMachine 
             path={path} simState={simState} onFinish={handleFinish} onCollision={handleCollision} 
             workpieceColor={workpieceColor} toolSetup={toolSetup} stockSetup={stockSetup}
          />

          {simState === 'COLLISION' && <Explosion position={crashPos} />}
          {isVictory && <Confetti />}

          {simState === 'COLLISION' && (
            <Html center>
              <div style={{ color: '#ff4444', fontSize: '50px', fontWeight: '900', textShadow: '0 0 20px red', whiteSpace: 'nowrap', textAlign: 'center', pointerEvents: 'none' }}>
                💥 COLISÃO!<br/>
                <span style={{ fontSize: '20px', color: '#ffaaaa', fontWeight: 'bold' }}>
                  {collisionType === 'CRASH_G00' ? 'AVANÇO RÁPIDO (G0) NO MATERIAL' : 'LIMITE DE PLACA / CENTRO'}
                </span>
              </div>
            </Html>
          )}

          {isVictory && (
            <Html center>
              <div style={{ color: '#00ff88', fontSize: '60px', fontWeight: '900', textShadow: '0 0 20px #00ff88', whiteSpace: 'nowrap', textAlign: 'center', pointerEvents: 'none' }}>
                🎉 PARABÉNS! 🎉<br/>
                <span style={{ fontSize: '22px', color: '#ffffff', fontWeight: 'bold', textShadow: '0 0 10px #000' }}>
                  PEÇA CONCLUÍDA COM SUCESSO
                </span>
              </div>
            </Html>
          )}

          <OrbitControls makeDefault enablePan={true} enableZoom={true} enableRotate={true} />
          {bgColor === 'hdri' ? <Environment preset="warehouse" background blur={0.1} /> : <Environment preset="studio" />}
        </Canvas>
      </div>
    </div>
  );
}