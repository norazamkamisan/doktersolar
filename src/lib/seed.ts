import type { LatLng, Project, ProjectStatus, Settings } from '../types';
import { defaultDesign, defaultEnergy, withComputed } from './defaults';

/** Rectangle of w × h metres centred on a point, rotated `angle` degrees clockwise. */
function rectRoof(lat: number, lng: number, w: number, h: number, angle: number): LatLng[] {
  const a = (angle * Math.PI) / 180;
  const mPerDegLat = 110540;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  return (
    [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ] as [number, number][]
  ).map(([x, y]) => {
    const xr = x * Math.cos(a) + y * Math.sin(a);
    const yr = -x * Math.sin(a) + y * Math.cos(a);
    return [lat + yr / mPerDegLat, lng + xr / mPerDegLng];
  });
}

function monthsAgo(n: number, day = 10): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(Math.min(day, 28));
  return d.toISOString();
}

interface SeedRow {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  monthlyBill: number;
  status: ProjectStatus;
  created: number;
  roof: { w: number; h: number; angle: number } | null;
  azimuth: number;
  notes: string;
}

const ROWS: SeedRow[] = [
  {
    customerName: 'Aisyah Rahman',
    email: 'aisyah.rahman@example.com',
    phone: '+60 12-345 6789',
    address: 'Taman Tun Dr Ismail, 60000 Kuala Lumpur',
    lat: 3.147945,
    lng: 101.63,
    monthlyBill: 480,
    status: 'Installed',
    created: 5,
    roof: { w: 11, h: 6.5, angle: 0 },
    azimuth: 180,
    notes: 'Install completed. Customer asked about adding a battery next year.',
  },
  {
    customerName: 'Daniel Lim',
    email: 'daniel.lim@example.com',
    phone: '+60 16-222 1188',
    address: 'Seksyen 7, 40000 Shah Alam, Selangor',
    lat: 3.073036,
    lng: 101.492784,
    monthlyBill: 380,
    status: 'Won',
    created: 4,
    roof: { w: 9.5, h: 5.5, angle: -10 },
    azimuth: 170,
    notes: 'Signed. Install scheduled after TNB approval.',
  },
  {
    customerName: 'Priya Nair',
    email: 'priya.nair@example.com',
    phone: '+60 17-808 4512',
    address: 'Seksyen 7, 40000 Shah Alam, Selangor',
    lat: 3.073,
    lng: 101.493,
    monthlyBill: 560,
    status: 'Proposal Sent',
    created: 2,
    roof: { w: 12, h: 6.5, angle: -10 },
    azimuth: 170,
    notes: 'Comparing two quotes. Follow up next week.',
  },
  {
    customerName: 'Hafiz Osman',
    email: 'hafiz.osman@example.com',
    phone: '+60 19-555 2040',
    address: 'Bayan Lepas, 11900 Pulau Pinang',
    lat: 5.329,
    lng: 100.285,
    monthlyBill: 300,
    status: 'Designing',
    created: 1,
    roof: { w: 8, h: 5, angle: 30 },
    azimuth: 210,
    notes: 'Wants to keep the east side clear for a skylight.',
  },
  {
    customerName: 'Tan Mei Ling',
    email: 'meiling.tan@example.com',
    phone: '+60 11-2345 6700',
    address: 'Taman Molek, 81100 Johor Bahru, Johor',
    lat: 1.526,
    lng: 103.787,
    monthlyBill: 260,
    status: 'Lead',
    created: 0,
    roof: null,
    azimuth: 180,
    notes: 'Enquiry from website form.',
  },
];

export function buildSeedProjects(settings: Settings): Project[] {
  return ROWS.map((r, i) => {
    const createdAt = monthsAgo(r.created, 5 + i * 4);
    const updated = new Date(createdAt);
    updated.setDate(updated.getDate() + 6);
    const updatedAt = new Date(Math.min(updated.getTime(), Date.now())).toISOString();
    const design = {
      ...defaultDesign(settings),
      azimuth: r.azimuth,
      roof: r.roof ? rectRoof(r.lat, r.lng, r.roof.w, r.roof.h, r.roof.angle) : [],
    };
    const p: Project = {
      id: `demo-${i + 1}`,
      customerName: r.customerName,
      email: r.email,
      phone: r.phone,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      monthlyBill: r.monthlyBill,
      status: r.status,
      notes: r.notes,
      createdAt,
      updatedAt,
      design,
      energy: defaultEnergy(settings),
      panelCount: 0,
      systemKw: 0,
      proposalSentAt: ['Proposal Sent', 'Won', 'Installed'].includes(r.status) ? updatedAt : null,
    };
    return withComputed(p);
  });
}
