import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

const BASE_GCODE = `O0001 (REGUA CILINDRICA)
N10 G17 G21 G40 G80 G90
N20 (FERRAMENTA DE ACABAMENTO)
N30 G53 X0
N40 G53 Z0
N50 T0101 (DNMG 15 PDJNL)
N60 G54
N70 G92 S250
N80 G96 S3000 M4
N90 (TORNEAMENTO PERFIL)
N100 G00 Z2.
N110 G00 X10.
N120 G01 Z0.
; --- INSIRA AS COORDENADAS ABAIXO ---
G01 X12. Z-1.
G01 Z-13.
G01 X17.
G01 Z-19.
G01 X21.
; ------------------------------------
N180 G00 G53 X0.
N190 G00 G53 Z0.
N200 M5
N210 M30`;

// Componente da Placa Universal (3 Castanhas)
function Placa3Castanhas({ groupRef }) {
  return (
    <group ref={groupRef} position={[0, 0, -25]}>
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

// Simulador CNC e Animação
function CNCMachine({ path, simState, onFinish, onCollision }) {
  const toolGroupRef = useRef();
  const workpieceMeshRef = useRef();
  const rotGroupRef = useRef();
  
  const animState = useRef({ index: 0, t: 0 });
  const prevToolPos = useRef({ r: 5, z: 2 });
  
  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(10.5, 10.5, 25, 128, 256);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -12.5);
    return geo;
  }, []);

  const originalPositions = useMemo(() => new Float32Array(geometry.attributes.position.array), [geometry]);
  const currentRadii = useRef(new Float32Array(originalPositions.length / 3).fill(10.5));

  useEffect(() => {
    if (simState === 'PLAYING' && path.length > 0) {
      animState.current = { index: 0, t: 0 };
      const startR = path[0].x / 2;
      prevToolPos.current = { r: startR, z: path[0].z };
      
      if (toolGroupRef.current) {
        toolGroupRef.current.position.set(startR, 0, path[0].z);
      }
      
      currentRadii.current.fill(10.5);
      const positions = workpieceMeshRef.current.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i++) {
         positions[i] = originalPositions[i];
      }
      workpieceMeshRef.current.geometry.attributes.position.needsUpdate = true;
      workpieceMeshRef.current.geometry.computeVertexNormals();
    }
  }, [simState, path, originalPositions]);

  useFrame((state, delta) => {
    if (simState === 'PLAYING') {
      if (rotGroupRef.current) rotGroupRef.current.rotation.z -= 15 * delta;
    }

    if (simState !== 'PLAYING' || path.length < 2) return;
    
    let { index, t } = animState.current;
    if (index >= path.length - 1) return;

    const p1 = path[index];
    const p2 = path[index + 1];
    
    const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const speed = 12; 
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

    if (currentR < 0 || cz < -19.5) {
        onCollision();
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
            
            if (r_cut < currentRadii.current[i/3]) {
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
        <Placa3Castanhas groupRef={rotGroupRef} />
        
        <group ref={rotGroupRef}>
            <mesh ref={workpieceMeshRef} geometry={geometry}>
                <meshStandardMaterial color="#9ba4b5" metalness={0.7} roughness={0.3} />
            </mesh>
        </group>

        {/* Ferramenta Completa: PDJNL Esquerdo com Pastilha DNMG 15 */}
        {(simState === 'PLAYING' || simState === 'FINISHED') && (
            <group ref={toolGroupRef} position={[5, 0, 2]}>
                
                {/* Corpo do Suporte 20x20x100 */}
                <mesh position={[55, -10, 10]}>
                    <boxGeometry args={[100, 20, 20]} />
                    <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
                </mesh>

                {/* Detalhe da cabeça angulada do suporte PDJNL */}
                <mesh position={[7, -10, 3]} rotation={[0, -Math.PI / 10, 0]}>
                    <boxGeometry args={[15, 20, 14]} />
                    <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
                </mesh>

                {/* Conjunto da Pastilha DNMG e Grampo */}
                <group position={[0, -2.5, 0]} rotation={[0, Math.PI / 5, 0]}>
                    
                    {/* Pastilha DNMG 15 (Losango de 55 graus maior) */}
                    <mesh position={[15.5, 0, 0]} scale={[15.5, 1, 8.5]}>
                        <cylinderGeometry args={[1, 1, 4.76, 4]} />
                        <meshStandardMaterial color="#ffd700" metalness={0.6} roughness={0.2} />
                    </mesh>

                    {/* Grampo (Clamp superior) da PDJNL */}
                    <mesh position={[17.5, 2.5, 0]} rotation={[0, 0, -0.05]}>
                        <boxGeometry args={[11, 4, 7]} />
                        <meshStandardMaterial color="#050505" metalness={0.9} roughness={0.4} />
                    </mesh>

                    {/* Parafuso do Grampo */}
                    <mesh position={[20, 4.5, 0]}>
                        <cylinderGeometry args={[1.5, 1.5, 1.5, 16]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>

                </group>
                
            </group>
        )}
    </group>
  );
}

export default function App() {
  const [gcode, setGcode] = useState(BASE_GCODE);
  const [status, setStatus] = useState('AGUARDANDO...');
  const [path, setPath] = useState([]);
  const [simState, setSimState] = useState('IDLE'); 

  const simularUsinagem = () => {
    setStatus('SIMULANDO...');
    setSimState('IDLE');
    
    const linhas = gcode.split('\n');
    let currentX = 10;
    let currentZ = 2;
    const newPath = [{ x: currentX, z: currentZ }];

    linhas.forEach(linha => {
      const upperLine = linha.toUpperCase();
      if (upperLine.includes('G53')) return; 
      if (upperLine.includes('G00') || upperLine.includes('G01')) {
        const matchX = upperLine.match(/X([-\d.]+)/);
        const matchZ = upperLine.match(/Z([-\d.]+)/);
        if (matchX) currentX = parseFloat(matchX[1]);
        if (matchZ) currentZ = parseFloat(matchZ[1]);
        newPath.push({ x: currentX, z: currentZ });
      }
    });

    setPath(newPath);
    
    setTimeout(() => {
        setSimState('PLAYING');
    }, 100);
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

  const handleCollision = () => {
    setSimState('COLLISION');
    setStatus('GAME OVER: COLISÃO COM A PLACA / LINHA DE CENTRO!');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#1e1e1e', color: '#fff', fontFamily: 'monospace' }}>
      <div style={{ width: '35%', padding: '20px', backgroundColor: '#2d2d2d', borderRight: '4px solid #444', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ color: '#e0c020', marginBottom: '10px', fontSize: '1.2rem' }}>DESAFIO CNC - MUNDO SENAI</h2>
        <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '20px' }}>Complete as coordenadas de perfil (G01) para a Régua Cilíndrica. Ferramenta: DNMG 15 / Suporte PDJNL (Esquerdo) 20x20.</p>
        
        <textarea 
          value={gcode}
          onChange={(e) => setGcode(e.target.value)}
          style={{ flex: 1, backgroundColor: '#1e1e1e', color: '#569cd6', padding: '15px', border: '1px solid #555', fontSize: '14px', resize: 'none', outline: 'none' }}
        />
        
        <button 
          onClick={simularUsinagem}
          style={{ marginTop: '20px', padding: '15px', backgroundColor: '#007acc', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          INICIAR CICLO (CYCLE START)
        </button>

        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: simState === 'COLLISION' ? '#a00' : (status.includes('PARABÉNS') ? '#0a0' : '#444'), textAlign: 'center', fontWeight: 'bold' }}>
          {status}
        </div>
      </div>

      <div style={{ width: '65%', position: 'relative' }}>
        <Canvas camera={{ position: [30, 25, 45], fov: 45 }}>
          <color attach="background" args={['#111']} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          
          <CNCMachine 
             path={path} 
             simState={simState} 
             onFinish={handleFinish} 
             onCollision={handleCollision} 
          />

          {simState === 'COLLISION' && (
            <Html center>
              <div style={{ color: '#ff4444', fontSize: '60px', fontWeight: '900', textShadow: '0 0 20px red', whiteSpace: 'nowrap' }}>
                💥 COLISÃO!
              </div>
            </Html>
          )}

          <OrbitControls makeDefault />
          <Environment preset="studio" />
        </Canvas>
      </div>
    </div>
  );
}