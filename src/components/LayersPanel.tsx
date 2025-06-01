import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, Edit2, FolderPlus, FolderX } from 'lucide-react';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

const LayersPanel: React.FC = () => {
  const { 
    objects, 
    removeObject, 
    toggleVisibility, 
    updateObjectName, 
    selectedObject,
    selectedObjects,
    setSelectedObject,
    toggleObjectSelection,
    createGroup,
    ungroup
  } = useSceneStore();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const saveEdit = () => {
    if (editingId && editingName.trim()) {
      updateObjectName(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const renderObject = (obj: { id: string; name: string; visible: boolean; object: THREE.Object3D; parentId?: string }) => {
    const isGroup = obj.object instanceof THREE.Group;
    const isSelected = selectedObjects.has(obj.id) || selectedObject === obj.object;
    const children = objects.filter(o => o.parentId === obj.id);

    return (
      <div key={obj.id} className="space-y-1">
        <div 
          className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${
            isSelected ? 'bg-blue-50' : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) {
              toggleObjectSelection(obj.id);
            } else {
              setSelectedObject(obj.object);
            }
          }}
        >
          <div className="flex items-center gap-2">
            {editingId === obj.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                className="border rounded px-2 py-1 w-32"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="flex-1">{obj.name}</span>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (editingId !== obj.id) startEditing(obj.id, obj.name);
              }}
              className="p-1 hover:text-blue-600"
              title="Rename"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleVisibility(obj.id);
              }}
              className="p-1 hover:text-blue-600"
              title={obj.visible ? 'Hide' : 'Show'}
            >
              {obj.visible ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>
            {isGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  ungroup(obj.id);
                }}
                className="p-1 hover:text-orange-600"
                title="Ungroup"
              >
                <FolderX className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeObject(obj.id);
              }}
              className="p-1 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {children.length > 0 && (
          <div className="ml-4 border-l pl-2">
            {children.map(child => renderObject(child))}
          </div>
        )}
      </div>
    );
  };

  const rootObjects = objects.filter(obj => !obj.parentId);
  const selectedCount = selectedObjects.size;

  return (
    <div className="absolute right-4 top-4 bg-white rounded-lg shadow-lg p-4 w-64">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Layers</h2>
        {selectedCount >= 2 && (
          <button
            onClick={createGroup}
            className="p-1 hover:text-blue-600"
            title="Create Group"
          >
            <FolderPlus className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {rootObjects.map(renderObject)}
      </div>
    </div>
  );
};

export default LayersPanel;