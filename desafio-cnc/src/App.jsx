import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

const BASE_GCODE = `O0001 (REGUA CILINDRICA)
N10 G17 G21 G40 G80 G90
N20 (FERRAMENTA DE ACABAMENTO)
N30 G53 X0
N40 G53 Z0
N50 T0101 (DCMT SDJCR)
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
function Placa3Castanhas() {
  return (
    <group position={[0, 0, -25]}>
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
function CNCMachine({ path, simState, onFinish, onCollision, workpieceColor }) {
  const toolGroupRef = useRef();
  const workpieceMeshRef = useRef();
  const rotGroupRef = useRef();
  const chipRef = useRef();
  const chipTimer = useRef(0);
  
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

  // Reset e Inicialização da Peça Bruta
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
      // A Placa e a Peça giram juntas
      if (rotGroupRef.current) {
        rotGroupRef.current.rotation.z -= 30 * delta; 
      }
      
      // Animação dinâmica do cavaco de metal a ser expulso
      if (chipRef.current) {
        chipTimer.current += delta * 6;
        const tCycle = chipTimer.current % 1;
        
        // O cavaco nasce na ponta da pastilha e voa para trás e para cima
        chipRef.current.position.set(
            8 - tCycle * 6, 
            1 + tCycle * 6,      
            tCycle * 4       
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
        {/* Agrupamento do fuso (spindle) que roda em conjunto */}
        <group ref={rotGroupRef}>
            <Placa3Castanhas />
            <mesh ref={workpieceMeshRef} geometry={geometry}>
                <meshStandardMaterial color={workpieceColor} metalness={0.6} roughness={0.3} />
            </mesh>
        </group>

        {/* Conjunto da Ferramenta de Torneamento */}
        {(simState === 'PLAYING' || simState === 'FINISHED') && (
            <group ref={toolGroupRef} position={[5, 0, 2]}>
                
                {/* Suporte da Ferramenta */}
                <group rotation={[0, Math.PI / 16, 0]}>
                    <mesh position={[35, -9, 0]}>
                        <boxGeometry args={[65, 16, 16]} />
                        <meshStandardMaterial color="#1f1f1f" metalness={0.8} roughness={0.4} />
                    </mesh>
                    <mesh position={[10, -9, -3]} rotation={[0, Math.PI / 8, 0]}>
                        <boxGeometry args={[18, 16, 14]} />
                        <meshStandardMaterial color="#1f1f1f" metalness={0.8} roughness={0.4} />
                    </mesh>
                </group>

                {/* Pastilha Rômbica e Parafuso */}
                <group position={[0, 0, 0]} rotation={[0, Math.PI / 5.5, 0]}>
                    <mesh position={[8, -1, 0]} scale={[8, 2, 4.2]}>
                        <cylinderGeometry args={[1, 1, 1, 4]} />
                        <meshStandardMaterial color="#ffd700" metalness={0.4} roughness={0.2} />
                    </mesh>
                    
                    <mesh position={[8, 0.1, 0]}>
                        <cylinderGeometry args={[1.5, 1.5, 0.4, 16]} />
                        <meshStandardMaterial color="#d0d0d0" metalness={0.9} roughness={0.2} />
                    </mesh>
                    
                    <mesh position={[8, 0.31, 0]}>
                        <cylinderGeometry args={[0.8, 0.8, 0.1, 6]} />
                        <meshBasicMaterial color="#111" />
                    </mesh>
                    
                    {/* Elemento 3D do Cavaco */}
                    {simState === 'PLAYING' && (
                        <mesh ref={chipRef}>
                            <torusGeometry args={[0.8, 0.15, 8, 12, Math.PI * 1.5]} />
                            <meshStandardMaterial color={workpieceColor} metalness={0.9} roughness={0.1} />
                        </mesh>
                    )}
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
  const [workpieceColor, setWorkpieceColor] = useState('#c0c8d0');
  const [bgColor, setBgColor] = useState('#17171e'); 

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

  const handleRestart = () => {
    setSimState('IDLE');
    setPath([]);
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

  const handleCollision = () => {
    setSimState('COLLISION');
    setStatus('GAME OVER: COLISÃO COM A PLACA / LINHA DE CENTRO!');
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
    { name: 'Verde Máquina', hex: '#2c3e35' },
    { name: 'Branco', hex: '#ffffff' }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#1e1e1e', color: '#fff', fontFamily: 'monospace' }}>
      <div style={{ width: '35%', padding: '20px', backgroundColor: '#2d2d2d', borderRight: '4px solid #444', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        <h2 style={{ color: '#e0c020', marginBottom: '10px', fontSize: '1.2rem' }}>DESAFIO CNC - MUNDO SENAI</h2>
        <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '20px' }}>Complete as coordenadas de perfil (G01) para a Régua Cilíndrica. Ferramenta: DCMT com fixação por parafuso.</p>
        
        <textarea 
          value={gcode}
          onChange={(e) => setGcode(e.target.value)}
          style={{ flex: 1, backgroundColor: '#1e1e1e', color: '#569cd6', padding: '15px', border: '1px solid #555', fontSize: '14px', resize: 'none', outline: 'none' }}
        />
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button 
            onClick={simularUsinagem}
            style={{ flex: 1, padding: '15px', backgroundColor: '#007acc', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
          >
            INICIAR CICLO
          </button>
          <button 
            onClick={handleRestart}
            style={{ padding: '15px 25px', backgroundColor: '#cc3300', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
          >
            RESTART
          </button>
        </div>

        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#1e1e1e', border: '1px solid #444' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>MATERIAL DA PEÇA:</span>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
            {materials.map((mat) => (
              <div 
                key={mat.hex}
                onClick={() => setWorkpieceColor(mat.hex)}
                title={mat.name}
                style={{ 
                  width: '35px', height: '35px', backgroundColor: mat.hex, borderRadius: '50%', cursor: 'pointer', 
                  border: workpieceColor === mat.hex ? '3px solid white' : '3px solid transparent',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1e1e1e', border: '1px solid #444' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>COR DO FUNDO:</span>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
            {backgrounds.map((bg) => (
              <div 
                key={bg.hex}
                onClick={() => setBgColor(bg.hex)}
                title={bg.name}
                style={{ 
                  width: '35px', height: '35px', backgroundColor: bg.hex, borderRadius: '4px', cursor: 'pointer', 
                  border: bgColor === bg.hex ? '3px solid #00ccff' : '3px solid #555'
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: simState === 'COLLISION' ? '#a00' : (status.includes('PARABÉNS') ? '#0a0' : '#444'), textAlign: 'center', fontWeight: 'bold' }}>
          {status}
        </div>
      </div>

      <div style={{ width: '65%', position: 'relative', backgroundColor: bgColor }}>
        <Canvas camera={{ position: [25, 25, 38], fov: 45 }}>
          <color attach="background" args={[bgColor]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={1.5} />
          <directionalLight position={[-10, 5, 5]} intensity={0.5} />
          
          <gridHelper args={[100, 25, '#444', '#222']} position={[0, -15, 0]} />

          <CNCMachine 
             path={path} 
             simState={simState} 
             onFinish={handleFinish} 
             onCollision={handleCollision} 
             workpieceColor={workpieceColor}
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