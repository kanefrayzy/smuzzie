'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminApi } from '@/lib/api';
import { ContactSubmission } from '@/types';
import { formatDate } from '@/lib/utils';
import { Mail, Trash2, Eye, Clock, Filter, MailOpen, Reply, Archive } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<ContactSubmission | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchContacts = async () => {
    try {
      const res = await adminApi.getContacts();
      setContacts(res.data.data || res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await adminApi.updateContactStatus(id, status);
      toast.success(`Status updated to ${status}`);
      fetchContacts();
      if (selectedContact?.id === id) {
        setSelectedContact({ ...selectedContact, status: status as any });
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this submission?')) return;
    try {
      await adminApi.deleteContact(id);
      toast.success('Deleted!');
      if (selectedContact?.id === id) setSelectedContact(null);
      setContacts(prev => prev.filter(contact => contact.id !== id));
    } catch {
      toast.error('Failed');
    }
  };

  const filteredContacts = statusFilter === 'all'
    ? contacts
    : contacts.filter((c) => c.status === statusFilter);

  const statusColors: Record<string, string> = {
    new: 'bg-red-400/10 text-red-400',
    read: 'bg-yellow-400/10 text-yellow-400',
    replied: 'bg-green-400/10 text-green-400',
    archived: 'bg-gray-400/10 text-gray-400',
  };

  const statusIcons: Record<string, any> = {
    new: Mail,
    read: MailOpen,
    replied: Reply,
    archived: Archive,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' } }} />

      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white">Contact Submissions</h1>
        <p className="text-gray-500 text-sm mt-1">{contacts.length} total messages</p>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-6">
        <Filter size={14} className="text-gray-500" />
        {['all', 'new', 'read', 'replied', 'archived'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
              statusFilter === status ? 'bg-accent-red text-white' : 'bg-surface text-gray-400 hover:text-white'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact list */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {filteredContacts.map((contact) => (
            <motion.div
              key={contact.id}
              layout
              className={`glass-card p-4 border cursor-pointer transition-all ${
                selectedContact?.id === contact.id
                  ? 'border-accent-red/30 bg-accent-red/5'
                  : 'border-white/5 hover:border-white/10'
              }`}
              onClick={() => setSelectedContact(contact)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-sm truncate">{contact.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[contact.status]}`}>
                      {contact.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-1">{contact.subject}</p>
                  <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
                    <Clock size={10} /> {formatDate(contact.created_at)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
          {filteredContacts.length === 0 && (
            <div className="text-center py-10 text-gray-500 text-sm">No messages found</div>
          )}
        </div>

        {/* Contact detail */}
        <div className="lg:col-span-2">
          {selectedContact ? (
            <div className="glass-card p-6 border border-white/5 sticky top-24">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-display font-bold text-white">{selectedContact.subject}</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    From: <span className="text-white">{selectedContact.name}</span> ({selectedContact.email})
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">{formatDate(selectedContact.created_at)}</p>
                </div>
                <button
                  onClick={() => handleDelete(selectedContact.id)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Message content */}
              <div className="bg-surface rounded-xl p-6 mb-6">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedContact.message}
                </p>
              </div>

              {/* Status actions */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 mr-2">Update status:</span>
                {['new', 'read', 'replied', 'archived'].map((status) => {
                  const Icon = statusIcons[status];
                  return (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(selectedContact.id, status)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                        selectedContact.status === status
                          ? statusColors[status]
                          : 'text-gray-500 hover:text-white bg-surface hover:bg-white/5'
                      }`}
                    >
                      <Icon size={12} />
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass-card p-16 border border-white/5 text-center">
              <Mail size={32} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500">Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
