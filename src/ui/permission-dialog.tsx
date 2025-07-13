import React, { useState } from 'react';

interface DomainInfo {
  domain: string;
  protocol: string;
  isSecure: boolean;
  reputation: 'trusted' | 'unknown' | 'suspicious';
}

interface PermissionDialogProps {
  origin: string;
  capabilities: string[];
  onGrant: (remember: boolean) => void;
  onDeny: (remember: boolean) => void;
}

interface IconProps {
  type: string;
}

const Icon: React.FC<IconProps> = ({ type }) => {
  const icons: Record<string, string> = {
    'read': '👁️',
    'write': '✏️',
    'execute': '⚡',
    'storage': '💾',
    'network': '🌐'
  };
  
  return <span className="icon">{icons[type] || '📋'}</span>;
};

const getCapabilityIcon = (capability: string): string => {
  if (capability.includes('read')) return 'read';
  if (capability.includes('write')) return 'write';
  if (capability.includes('execute')) return 'execute';
  if (capability.includes('storage')) return 'storage';
  if (capability.includes('network')) return 'network';
  return 'default';
};

const getCapabilityDescription = (capability: string): string => {
  const descriptions: Record<string, string> = {
    'dom.read': 'Read page content',
    'dom.write': 'Modify page content',
    'dom.execute': 'Execute automation actions',
    'storage.read': 'Read stored data',
    'storage.write': 'Save data locally',
    'network.fetch': 'Make network requests'
  };
  
  return descriptions[capability] || capability;
};

const getFavicon = (origin: string): string => {
  try {
    const url = new URL(origin);
    return `https://${url.hostname}/favicon.ico`;
  } catch {
    return 'default-favicon.png';
  }
};

const checkDomainReputation = (domain: string): 'trusted' | 'unknown' | 'suspicious' => {
  // In a real implementation, this would check against a reputation database
  const trustedDomains = [
    'google.com',
    'github.com',
    'stackoverflow.com',
    'wikipedia.org',
    'openai.com',
    'chatgpt.com'
  ];
  
  if (trustedDomains.some(trusted => domain.endsWith(trusted))) {
    return 'trusted';
  }
  
  // Check for suspicious patterns
  if (domain.includes('-') && domain.split('-').length > 3) {
    return 'suspicious';
  }
  
  return 'unknown';
};

export const PermissionDialog: React.FC<PermissionDialogProps> = ({ 
  origin, 
  capabilities,
  onGrant,
  onDeny 
}) => {
  const [rememberChoice, setRememberChoice] = useState(false);
  
  const getDomainInfo = (origin: string): DomainInfo => {
    try {
      const url = new URL(origin);
      return {
        domain: url.hostname,
        protocol: url.protocol,
        isSecure: url.protocol === 'https:',
        reputation: checkDomainReputation(url.hostname)
      };
    } catch {
      return {
        domain: origin,
        protocol: '',
        isSecure: false,
        reputation: 'unknown'
      };
    }
  };
  
  const domainInfo = getDomainInfo(origin);
  
  return (
    <div className="permission-dialog-overlay">
      <div className="permission-dialog">
        <div className="dialog-header">
          <img src={getFavicon(origin)} alt="" width="32" height="32" />
          <h3>Permission Request</h3>
          <button 
            className="close-button"
            onClick={() => onDeny(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="dialog-body">
          <p className="domain-info">
            <strong>{domainInfo.domain}</strong> wants to use Semantest automation
          </p>
          
          {!domainInfo.isSecure && (
            <div className="security-warning">
              ⚠️ This site is not using HTTPS. Your data may not be secure.
            </div>
          )}
          
          {domainInfo.reputation === 'suspicious' && (
            <div className="security-warning">
              ⚠️ This domain appears suspicious. Please verify before granting permission.
            </div>
          )}
          
          {domainInfo.reputation === 'trusted' && (
            <div className="security-info">
              ✅ This is a known trusted domain.
            </div>
          )}
          
          <div className="capabilities-list">
            <h4>This will allow the site to:</h4>
            <ul>
              {capabilities.map(cap => (
                <li key={cap}>
                  <Icon type={getCapabilityIcon(cap)} />
                  {getCapabilityDescription(cap)}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="privacy-note">
            <p>
              Semantest will only act on this site when you explicitly trigger automation.
              No data is collected or shared without your consent.
            </p>
          </div>
          
          <div className="remember-choice">
            <input 
              type="checkbox" 
              id="remember"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
            />
            <label htmlFor="remember">Remember my choice for this site</label>
          </div>
        </div>
        
        <div className="dialog-footer">
          <button 
            className="btn-deny"
            onClick={() => onDeny(rememberChoice)}
          >
            Deny
          </button>
          <button 
            className="btn-grant"
            onClick={() => onGrant(rememberChoice)}
            autoFocus
          >
            Grant Permission
          </button>
        </div>
      </div>
    </div>
  );
};