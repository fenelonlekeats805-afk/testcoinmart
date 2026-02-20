'use client';

import { useState } from 'react';
import { apiFetch } from '../lib/api';

type Order = {
  id: string;
  status: string;
  productId: string;
  createdAt: string;
  shipment?: { txHash?: string };
};

type Ticket = {
  id: string;
  orderId: string;
  status: string;
  contactType: string;
  contactValue: string;
};

export default function AdminPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [extra, setExtra] = useState<any[]>([]);
  const [error, setError] = useState('');

  async function login() {
    setError('');
    try {
      const body = await apiFetch('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(body.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  }

  async function loadOrders() {
    setOrders(await apiFetch('/admin/orders', undefined, token));
  }

  async function loadTickets() {
    setTickets(await apiFetch('/admin/tickets?status=open', undefined, token));
  }

  async function loadExtra() {
    setExtra(await apiFetch('/admin/extra-payments', undefined, token));
  }

  async function closeTicket(ticketId: string) {
    await apiFetch(`/admin/tickets/${ticketId}/close`, { method: 'PATCH' }, token);
    await loadTickets();
  }

  async function manualFulfill(orderId: string) {
    const txHash = window.prompt('Input shipment tx hash');
    if (!txHash) {
      return;
    }
    await apiFetch(`/admin/orders/${orderId}/manual-fulfill`, {
      method: 'POST',
      body: JSON.stringify({ txHash }),
    }, token);
    await loadOrders();
  }

  return (
    <main className="page">
      <section className="card" style={{ marginBottom: 12 }}>
        <h1 style={{ marginTop: 0 }}>Testcoin Admin</h1>
        <div className="row">
          <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="primary" onClick={login}>Login</button>
        </div>
        {token && <p>Authenticated</p>}
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      </section>

      <section className="card" style={{ marginBottom: 12 }}>
        <h2>Orders</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={loadOrders}>Reload Orders</button>
          <button onClick={loadExtra}>Load EXTRA_PAYMENT</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Status</th>
              <th>Product</th>
              <th>Shipment TX</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.status}</td>
                <td>{item.productId}</td>
                <td>{item.shipment?.txHash || '-'}</td>
                <td>
                  <button onClick={() => manualFulfill(item.id)}>Manual Fulfill</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {extra.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3>EXTRA_PAYMENT Orders</h3>
            <ul>
              {extra.map((item) => <li key={item.id}>{item.id}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Support Tickets (open)</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={loadTickets}>Reload Tickets</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Order ID</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.orderId}</td>
                <td>{item.contactType}:{item.contactValue}</td>
                <td>{item.status}</td>
                <td><button onClick={() => closeTicket(item.id)}>Close</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
