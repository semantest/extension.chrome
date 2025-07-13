import React, { useState, useEffect } from 'react';
import { Chrome } from '@semantest/browser';

interface PermissionState {
  origin: string;
  granted: boolean;
  grantedAt: number;
  capabilities: string[];
}

interface PermissionRequest {
  id: string;
  origin: string;
  capabilities: string[];
  timestamp: number;
}

interface PermissionItemProps {
  permission: PermissionState;
  onRevoke: (origin: string) => void;
}

const PermissionItem: React.FC<PermissionItemProps> = ({ permission, onRevoke }) => {
  return (
    <div className="permission-item">
      <img src={`https://${new URL(permission.origin).hostname}/favicon.ico`} alt="" width="16" height="16" />
      <span className="origin">{permission.origin}</span>
      <span className="granted-at">{new Date(permission.grantedAt).toLocaleDateString()}</span>
      <button onClick={() => onRevoke(permission.origin)}>Revoke</button>
    </div>
  );
};

interface PermissionRequestProps {
  request: PermissionRequest;
  onApprove: () => void;
  onDeny: () => void;
}

const PermissionRequestItem: React.FC<PermissionRequestProps> = ({ request, onApprove, onDeny }) => {
  return (
    <div className="permission-request">
      <p>{request.origin} is requesting permission to use Semantest automation</p>
      <div className="capabilities">
        <h4>Requested capabilities:</h4>
        <ul>
          {request.capabilities.map(cap => <li key={cap}>{cap}</li>)}
        </ul>
      </div>
      <div className="actions">
        <button onClick={onDeny}>Deny</button>
        <button onClick={onApprove} className="primary">Approve</button>
      </div>
    </div>
  );
};

export const PermissionManager: React.FC = () => {
  const [permissions, setPermissions] = useState<PermissionState[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PermissionRequest[]>([]);
  
  useEffect(() => {
    loadCurrentPermissions();
    chrome.permissions.onAdded.addListener(handlePermissionAdded);
    chrome.permissions.onRemoved.addListener(handlePermissionRemoved);
    
    return () => {
      chrome.permissions.onAdded.removeListener(handlePermissionAdded);
      chrome.permissions.onRemoved.removeListener(handlePermissionRemoved);
    };
  }, []);
  
  const loadCurrentPermissions = async () => {
    const perms = await chrome.permissions.getAll();
    const savedPermissions = await chrome.storage.local.get('semantest:permissions');
    
    if (savedPermissions['semantest:permissions']) {
      setPermissions(savedPermissions['semantest:permissions']);
    }
  };
  
  const handlePermissionAdded = (permissions: chrome.permissions.Permissions) => {
    console.log('Permission added:', permissions);
    loadCurrentPermissions();
  };
  
  const handlePermissionRemoved = (permissions: chrome.permissions.Permissions) => {
    console.log('Permission removed:', permissions);
    loadCurrentPermissions();
  };
  
  const requestPermission = async (origin: string): Promise<boolean> => {
    try {
      const granted = await chrome.permissions.request({
        origins: [`${origin}/*`]
      });
      
      if (granted) {
        await logPermissionGrant(origin);
        showNotification(`Permission granted for ${origin}`);
      }
      
      return granted;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  };
  
  const revokePermission = async (origin: string) => {
    try {
      await chrome.permissions.remove({
        origins: [`${origin}/*`]
      });
      
      setPermissions(perms => perms.filter(p => p.origin !== origin));
      showNotification(`Permission revoked for ${origin}`);
    } catch (error) {
      console.error('Failed to revoke permission:', error);
    }
  };
  
  const approveRequest = async (request: PermissionRequest) => {
    const granted = await requestPermission(request.origin);
    
    if (granted) {
      const newPermission: PermissionState = {
        origin: request.origin,
        granted: true,
        grantedAt: Date.now(),
        capabilities: request.capabilities
      };
      
      setPermissions(perms => [...perms, newPermission]);
      setPendingRequests(requests => requests.filter(r => r.id !== request.id));
      
      // Save to storage
      const updatedPermissions = [...permissions, newPermission];
      await chrome.storage.local.set({ 'semantest:permissions': updatedPermissions });
    }
  };
  
  const denyRequest = (request: PermissionRequest) => {
    setPendingRequests(requests => requests.filter(r => r.id !== request.id));
    showNotification(`Permission denied for ${request.origin}`);
  };
  
  const logPermissionGrant = async (origin: string) => {
    // Log permission grant for audit
    const log = {
      event: 'PERMISSION_GRANTED',
      origin,
      timestamp: Date.now(),
      userId: await getUserId()
    };
    
    await chrome.storage.local.set({
      [`semantest:audit:${Date.now()}`]: log
    });
  };
  
  const showNotification = (message: string) => {
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'Semantest Permissions',
        message
      });
    }
  };
  
  const getUserId = async (): Promise<string> => {
    const result = await chrome.storage.local.get('semantest:userId');
    return result['semantest:userId'] || 'unknown';
  };
  
  return (
    <div className="permission-manager">
      <h2>Site Permissions</h2>
      
      <div className="current-permissions">
        <h3>Active Permissions</h3>
        {permissions.length === 0 ? (
          <p className="empty-state">No permissions granted yet</p>
        ) : (
          permissions.map(perm => (
            <PermissionItem 
              key={perm.origin}
              permission={perm}
              onRevoke={revokePermission}
            />
          ))
        )}
      </div>
      
      {pendingRequests.length > 0 && (
        <div className="pending-requests">
          <h3>Permission Requests</h3>
          {pendingRequests.map(request => (
            <PermissionRequestItem
              key={request.id}
              request={request}
              onApprove={() => approveRequest(request)}
              onDeny={() => denyRequest(request)}
            />
          ))}
        </div>
      )}
    </div>
  );
};