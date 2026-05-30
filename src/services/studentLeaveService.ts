import api from './api';

export type StudentLeaveType = 'home_leave' | 'outpass' | 'medical_leave' | 'other';
export type StudentLeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface StudentLeaveRequest {
  id: string;
  leaveType: StudentLeaveType;
  startDate: string;
  endDate: string;
  status: StudentLeaveStatus;
  approvalMode?: 'manual' | 'auto' | null;
  reasonText?: string;
  campusDistanceKmAtSubmission: number;
  photoGpsMatchDistanceKm?: number | null;
  autoApprovalSummary?: string;
  requiresDailyReverification: boolean;
  leaveDates?: Array<{ date: string; status: string }>;
  proofFiles: Array<{ url: string; originalName: string }>;
  facePhoto?: { url: string; originalName: string } | null;
}

interface LeaveLocationPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt?: string;
}

function appendLocation(formData: FormData, prefix: '' | 'photo', payload?: LeaveLocationPayload | null) {
  if (!payload) return;
  const makeKey = (key: string) => (prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key);
  formData.append(makeKey('latitude'), String(payload.latitude));
  formData.append(makeKey('longitude'), String(payload.longitude));
  if (payload.accuracy !== undefined) formData.append(makeKey('accuracy'), String(payload.accuracy));
  if (payload.capturedAt) formData.append(makeKey('capturedAt'), payload.capturedAt);
}

function toUploadPart(asset: { uri?: string; type?: string; fileName?: string }) {
  return {
    uri: asset.uri!,
    type: asset.type || 'image/jpeg',
    name: asset.fileName || `upload-${Date.now()}.jpg`,
  } as any;
}

const studentLeaveService = {
  async list(): Promise<StudentLeaveRequest[]> {
    const res = await api.get('/student/leave-requests');
    const raw = res.data.data || [];
    return Array.isArray(raw) ? raw : [];
  },

  async get(id: string): Promise<StudentLeaveRequest> {
    const res = await api.get(`/student/leave-requests/${id}`);
    return res.data.data;
  },

  async create(input: {
    leaveType: StudentLeaveType;
    startDate: string;
    endDate: string;
    reasonText?: string;
    submissionLocation: LeaveLocationPayload;
    photoLocation?: LeaveLocationPayload | null;
    facePhoto?: { uri?: string; type?: string; fileName?: string } | null;
    faceVerificationConfirmed?: boolean;
    proofFiles: Array<{ uri?: string; type?: string; fileName?: string }>;
  }): Promise<StudentLeaveRequest> {
    const formData = new FormData();
    formData.append('leaveType', input.leaveType);
    formData.append('startDate', input.startDate);
    formData.append('endDate', input.endDate);
    if (input.reasonText) formData.append('reasonText', input.reasonText);
    appendLocation(formData, '', input.submissionLocation);
    appendLocation(formData, 'photo', input.photoLocation);
    if (input.faceVerificationConfirmed) {
      formData.append('faceVerificationConfirmed', 'true');
    }
    if (input.facePhoto?.uri) {
      formData.append('facePhoto', toUploadPart(input.facePhoto));
    }
    input.proofFiles.forEach(file => {
      if (file.uri) {
        formData.append('proofFiles', toUploadPart(file));
      }
    });

    const res = await api.post('/student/leave-requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async dailyVerify(id: string, input: {
    date: string;
    submissionLocation: LeaveLocationPayload;
    photoLocation?: LeaveLocationPayload | null;
    facePhoto?: { uri?: string; type?: string; fileName?: string } | null;
    note?: string;
  }) {
    const formData = new FormData();
    formData.append('date', input.date);
    appendLocation(formData, '', input.submissionLocation);
    appendLocation(formData, 'photo', input.photoLocation);
    if (input.note) formData.append('note', input.note);
    if (input.facePhoto?.uri) {
      formData.append('facePhoto', toUploadPart(input.facePhoto));
    }
    const res = await api.post(`/student/leave-requests/${id}/daily-verify`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};

export default studentLeaveService;
