// API — Module Congés (Code du travail / IDCC 3252)

export function registerLeavesMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    async getLeaveTypes() {
      return this.request('/leaves/types', { skipCamelCase: true });
    },
    async getPublicHolidays(year) {
      const qs = year ? `?year=${year}` : '';
      return this.request(`/leaves/holidays${qs}`);
    },
    async addPublicHoliday(date, name) {
      return this.request('/leaves/holidays', {
        method: 'POST',
        body: JSON.stringify({ date, name }),
      });
    },
    async deletePublicHoliday(id) {
      return this.request(`/leaves/holidays/${id}`, { method: 'DELETE' });
    },
    async calculateLeaveWorkingDays(data) {
      return this.request('/leaves/calculate', { method: 'POST', body: JSON.stringify(data) });
    },
    async createLeaveRequest(data) {
      return this.request('/leaves', { method: 'POST', body: JSON.stringify(data) });
    },
    async getMyLeaves() {
      return this.request('/leaves/mine');
    },
    async getAllLeaves(params = {}) {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.personId) query.set('personId', params.personId);
      if (params.leaveType) query.set('leaveType', params.leaveType);
      if (params.startDate) query.set('startDate', params.startDate);
      if (params.endDate) query.set('endDate', params.endDate);
      const qs = query.toString();
      return this.request(`/leaves${qs ? '?' + qs : ''}`);
    },
    async getPendingLeaves() {
      return this.request('/leaves/pending');
    },
    async getPendingLeavesCount() {
      return this.request('/leaves/pending/count');
    },
    async getLeaveDetail(id) {
      return this.request(`/leaves/${id}`);
    },
    async makeLeaveDecision(id, data) {
      return this.request(`/leaves/${id}/decision`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async signLeave(id, signature, role) {
      return this.request(`/leaves/${id}/sign`, {
        method: 'PUT',
        body: JSON.stringify({ signature, role }),
      });
    },
    async cancelLeave(id) {
      return this.request(`/leaves/${id}/cancel`, { method: 'PUT' });
    },
    async uploadLeaveJustification(id, filename, data) {
      return this.request(`/leaves/${id}/justification`, {
        method: 'POST',
        body: JSON.stringify({ filename, data }),
      });
    },
    async getLeaveBalances(params = {}) {
      const query = new URLSearchParams();
      if (params.personId) query.set('personId', params.personId);
      if (params.year) query.set('year', params.year);
      const qs = query.toString();
      return this.request(`/leaves/balances${qs ? '?' + qs : ''}`);
    },
    async updateLeaveBalance(data) {
      return this.request('/leaves/balances', { method: 'PUT', body: JSON.stringify(data) });
    },
    async getLeavePdf(id) {
      return this.request(`/leaves/${id}/pdf`);
    },
    async getLeaveStats(year) {
      const qs = year ? `?year=${year}` : '';
      return this.request(`/leaves/stats${qs}`);
    },
    async getLeaveConflicts() {
      return this.request('/leaves/conflicts');
    },
    async getLeaveHistory(id) {
      return this.request(`/leaves/${id}/history`);
    },
  });
}
