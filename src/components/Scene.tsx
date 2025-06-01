import React, { useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

const DraggableVertex = ({ position, selected, onClick, vertexIndex }: { position: THREE.Vector3, selected: boolean, onClick: () => void, vertexIndex: number }) => {
  const mesh = useRef<THREE.Mesh>(null);
  const dragStart = useRef<THREE.Vector3>();
  const selectedObject = useSceneStore(state => state.selectedObject as THREE.Mesh);
  const geometry = selectedObject?.geometry as THREE.BufferGeometry;
  const positionAttribute = geometry?.attributes.position;

  // Maya-like soft selection falloff function
  const calculateFalloff = (distance: number, radius: number = 1): number => {
    if (distance >= radius) return 0;
    const t = distance / radius;
    // Using Maya's soft selection curve approximation
    return Math.pow(1 - Math.pow(t, 2), 2);
  };

  const onPointerDown = (e: any) => {
    e.stopPropagation();
    if (selected && mesh.current) {
      dragStart.current = new THREE.Vector3();
      mesh.current.getWorldPosition(dragStart.current);
    }
  };

  const onPointerMove = (e: any) => {
    if (!dragStart.current || !selected || !positionAttribute || !mesh.current) return;

    // Get pointer position in world space
    const pointer = new THREE.Vector3(e.point.x, e.point.y, e.point.z);
    const delta = pointer.sub(dragStart.current);
    
    // Convert to object space
    const worldToLocal = selectedObject.matrixWorld.clone().invert();
    const localDelta = delta.clone().applyMatrix4(worldToLocal);

    // Get the selected vertex position
    const selectedVertexPos = new THREE.Vector3().fromBufferAttribute(positionAttribute, vertexIndex);
    
    // Update vertices with soft selection
    for (let i = 0; i < positionAttribute.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
      const distance = vertex.distanceTo(selectedVertexPos);
      const influence = calculateFalloff(distance, 2);
      
      if (influence > 0) {
        const newPosition = vertex.clone().add(localDelta.clone().multiplyScalar(influence));
        positionAttribute.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
      }
    }

    // Update geometry
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    dragStart.current.copy(pointer);
  };

  const onPointerUp = () => {
    dragStart.current = undefined;
  };

  return (
    <mesh
      ref={mesh}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshBasicMaterial 
        color={selected ? '#ff0000' : '#ffffff'}
        transparent
        opacity={0.8}
        depthTest={false}
      />
    </mesh>
  );
};

const MeshHelpers = () => {
  const { selectedObject, editMode, selectedElements, selectElements } = useSceneStore();

  if (!(selectedObject instanceof THREE.Mesh) || editMode === 'object') return null;

  const geometry = selectedObject.geometry;
  const position = geometry.attributes.position;
  const vertices: THREE.Vector3[] = [];
  const vertexIndices: number[] = [];
  const matrix = selectedObject.matrixWorld;

  // Get unique vertices using a more precise comparison
  const uniqueVertices = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3();
    vertex.fromBufferAttribute(position, i);
    vertex.applyMatrix4(matrix);
    
    // Use higher precision for vertex position comparison
    const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
    if (!uniqueVertices.has(key)) {
      uniqueVertices.set(key, i);
      vertices.push(vertex);
      vertexIndices.push(i);
    }
  }

  const handleElementSelect = (index: number) => {
    selectElements([vertexIndices[index]]);
  };

  if (editMode === 'vertex') {
    return (
      <group>
        {vertices.map((vertex, i) => (
          <DraggableVertex
            key={i}
            position={vertex}
            selected={selectedElements.includes(vertexIndices[i])}
            onClick={() => handleElementSelect(i)}
            vertexIndex={vertexIndices[i]}
          />
        ))}
      </group>
    );
  }

  return null;
};

const Scene: React.FC = () => {
  const { 
    objects, 
    selectedObject, 
    selectedObjects,
    setSelectedObject, 
    toggleObjectSelection,
    transformMode,
    editMode,
    clearElementSelection
  } = useSceneStore();

  return (
    <Canvas
      camera={{ position: [5, 5, 5], fov: 75 }}
      className="w-full h-full bg-gray-900"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedObject(null);
          clearElementSelection();
        }
      }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      <Grid
        infiniteGrid
        cellSize={1}
        sectionSize={3}
        fadeDistance={30}
        fadeStrength={1}
      />

      {objects.map(({ object, visible, id }) => (
        visible && (
          <primitive
            key={id}
            object={object}
            onClick={(e) => {
              e.stopPropagation();
              if (e.ctrlKey || e.metaKey) {
                toggleObjectSelection(id);
              } else {
                setSelectedObject(object);
              }
            }}
          />
        )
      ))}

      {selectedObject && editMode === 'object' && (
        <TransformControls
          object={selectedObject}
          mode={transformMode}
          onObjectChange={() => useSceneStore.getState().updateObjectProperties()}
          space="world"
        />
      )}

      <MeshHelpers />

      <OrbitControls
        makeDefault
        enabled={true}
      />
    </Canvas>
  );
};

export default Scene;