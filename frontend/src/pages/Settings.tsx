import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/client';
import { useApiToast } from '../components/ui';
import { useAuthStore } from '../stores';
import { Badge, Button, Card, EmptyState, Input, Modal, Spinner } from '../components/ui';
import type { APIKeyOut, APIKeyCreated } from '../api/client';

export function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'api-keys'>('profile');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-bold text-foundry-50">Settings</h1>
        <p className="mt-1 text-foundry-400">Manage your account and API access</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-sm font-mono rounded ${
            activeTab === 'profile'
              ? 'bg-amber-600 text-white'
              : 'bg-foundry-800 text-foundry-300 hover:bg-foundry-700'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('api-keys')}
          className={`px-4 py-2 text-sm font-mono rounded ${
            activeTab === 'api-keys'
              ? 'bg-amber-600 text-white'
              : 'bg-foundry-800 text-foundry-300 hover:bg-foundry-700'
          }`}
        >
          API Keys
        </button>
      </div>

      {activeTab === 'profile' ? <ProfileTab /> : <ApiKeysTab />}
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuthStore();

  if (!user) return <Spinner />;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-medium text-foundry-100 mb-4">Account Information</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Email</label>
            <Input value={user.email} disabled />
          </div>
          <div>
            <label className="label">User ID</label>
            <Input value={user.id} disabled />
          </div>
          <div>
            <label className="label">Created</label>
            <Input value={new Date(user.created_at).toLocaleDateString()} disabled />
          </div>
        </div>
      </Card>
    </div>
  );
}

function ApiKeysTab() {
  const queryClient = useQueryClient();
  const apiToast = useApiToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<APIKeyCreated | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => authApi.apiKeys.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => authApi.apiKeys.create({ name }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreatedKey(data);
      setShowCreate(false);
      setNewKeyName('');
      apiToast.success('API key created');
    },
    onError: (e) => apiToast.catch(e, 'Failed to create API key'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      setDeletingKeyId(id);
      return authApi.apiKeys.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setDeletingKeyId(null);
      apiToast.success('API key deleted');
    },
    onError: (e) => {
      setDeletingKeyId(null);
      apiToast.catch(e, 'Failed to delete API key');
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foundry-100">API Keys</h2>
          <p className="text-sm text-foundry-400">Manage API keys for programmatic access</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create Key</Button>
      </div>

      {createdKey && (
        <Card className="p-6 border-amber-500/50">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-amber-400 mb-2">
                Your API key has been created. Copy it now - you won't be able to see it again.
              </h3>
              <code className="text-sm bg-foundry-800 px-3 py-2 rounded block font-mono text-foundry-100">
                {createdKey.key}
              </code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey.key);
                apiToast.success('Copied to clipboard');
              }}
              className="px-3 py-1.5 text-xs font-mono bg-amber-600 text-white rounded hover:bg-amber-500"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-3 text-xs text-foundry-400 hover:text-foundry-300"
          >
            Dismiss
          </button>
        </Card>
      )}

      {!keys || keys.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No API keys" description="Create an API key to get started" />
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((key: APIKeyOut) => (
            <Card key={key.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foundry-100">{key.name}</span>
                  <p className="text-xs text-foundry-400 mt-1">
                    Key ID: <code className="font-mono">{key.id}</code>
                  </p>
                  <p className="text-xs text-foundry-400">
                    Created: {new Date(key.created_at).toLocaleDateString()}
                  </p>
                  {key.last_used_at && (
                    <p className="text-xs text-foundry-400">
                      Last used: {new Date(key.last_used_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={key.is_active ? 'success' : 'neutral'}>
                    {key.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <button
                    onClick={() => deleteMutation.mutate(key.id)}
                    disabled={deleteMutation.isPending && deletingKeyId === key.id}
                    className="px-3 py-1.5 text-xs font-mono text-red-400 border border-red-900/50 rounded hover:bg-red-900/20 disabled:opacity-50"
                  >
                    {deleteMutation.isPending && deletingKeyId === key.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create API Key">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(newKeyName);
          }}
          className="space-y-4"
        >
          <Input
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g., CI/CD Pipeline"
            required
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
