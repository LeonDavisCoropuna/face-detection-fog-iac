
import React, { useState } from 'react';
import { useAlerts } from '../contexts/AlertContext';
import { SecurityAlert } from '../types';
import { jsPDF } from 'jspdf';

const Alerts: React.FC = () => {
  const { alerts, markAsReviewed } = useAlerts();
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isMarkingLoading, setIsMarkingLoading] = useState(false);

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return date.toLocaleString();
  };

  const handleMarkAsReviewed = async (id: string) => {
    setIsMarkingLoading(true);
    try {
      await markAsReviewed(id);
    } catch (error) {
      console.error("Error marking as reviewed:", error);
    } finally {
      setIsMarkingLoading(false);
    }
  };

  const handleDownloadPDF = async (alert: SecurityAlert) => {
    setIsGeneratingPDF(true);
    const doc = new jsPDF();
    const timestamp = formatTime(alert.createdAt);

    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SENTINEL SECURITY SYSTEMS', 20, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('INCIDENT EVIDENCE REPORT', 20, 32);

    // Content Body
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Alert Details', 20, 55);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Alert ID: ${alert.id.toUpperCase()}`, 20, 65);
    doc.text(`Date/Time: ${timestamp}`, 20, 72);
    doc.text(`Status: ${alert.status}`, 20, 79);
    doc.text(`Location: CAM-04 (Main Entrance)`, 20, 86);
    doc.text(`Identification: ${alert.status === 'MATCH' ? alert.matchedWith : 'Unknown Person'}`, 20, 93);
    doc.text(`Similarity Score: ${(100 - (alert.distance * 100)).toFixed(1)}%`, 20, 100);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 105, 190, 105);

    doc.setFont('helvetica', 'bold');
    doc.text('Visual Evidence', 20, 115);

    try {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('* Images are attached to the digital evidence log in the cloud.', 20, 125);
      doc.text(`Source URL: ${alert.imageUrl}`, 20, 130);
    } catch (e) {
      console.error("Could not add images to PDF", e);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerY = 280;
    doc.text('This document is an automated security report. Confidential.', 105, footerY, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, footerY + 5, { align: 'center' });

    doc.save(`Sentinel_Alert_${alert.id.substring(0, 8)}.pdf`);
    setIsGeneratingPDF(false);
  };

  const StatusBadge: React.FC<{ alert: SecurityAlert }> = ({ alert }) => {
    if (alert.status === 'MATCH') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-200">
          <i className="fas fa-check-circle"></i> MATCH
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-200 animate-pulse">
        <i className="fas fa-triangle-exclamation"></i> UNKNOWN
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Alerts</h1>
          <p className="text-gray-500 mt-1">Real-time intrusion detection logs</p>
        </div>
        {isGeneratingPDF && (
          <div className="flex items-center gap-2 text-blue-600 font-bold text-sm animate-pulse">
            <i className="fas fa-file-pdf"></i> Generating Report...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Alerts Feed */}
        <div className="xl:col-span-2 space-y-4">
          {alerts.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                <i className="fas fa-shield-slash text-2xl"></i>
              </div>
              <h3 className="font-bold text-gray-900">No active alerts</h3>
              <p className="text-gray-500 mt-1">Your facilities are currently secure.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`
                  group relative bg-white border rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1
                  ${!alert.reviewed ? 'border-blue-200 ring-1 ring-blue-100 shadow-lg shadow-blue-500/5' : 'border-gray-200 grayscale-[0.3]'}
                `}
              >
                {!alert.reviewed && (
                  <div className="absolute top-4 right-4 w-3 h-3 bg-blue-600 rounded-full"></div>
                )}
                
                <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
                  <img src={alert.croppedFaceUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Face" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <StatusBadge alert={alert} />
                    <span className="text-xs text-gray-400">{formatTime(alert.createdAt)}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 truncate">
                    {alert.status === 'MATCH' ? `Coincidence with ${alert.matchedWith}` : 'Unknown Intrusion Detected'}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <i className="fas fa-expand-arrows-alt"></i> Distance: {(alert.distance * 100).toFixed(1)}%
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="fas fa-camera"></i> CAM-04 (Main Entrance)
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block">
                  <i className="fas fa-chevron-right text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all"></i>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Alert Details */}
        <div className="hidden xl:block">
          <div className="sticky top-8 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm min-h-[600px] flex flex-col">
            {selectedAlert ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold">Alert Details</h2>
                  <StatusBadge alert={selectedAlert} />
                </div>

                <div className="space-y-6 flex-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Live Snapshot</label>
                    <div className="relative group rounded-xl overflow-hidden border border-gray-100">
                      <img src={selectedAlert.imageUrl} className="w-full aspect-video object-cover" alt="Full" />
                      <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                      <img src={selectedAlert.croppedFaceUrl} className="w-full h-full object-cover" alt="Face crop" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Recognition Result</label>
                      <p className="font-bold text-gray-900">{selectedAlert.status === 'MATCH' ? selectedAlert.matchedWith : 'No Match Found'}</p>
                      <p className="text-xs text-gray-500 mt-1">Face distance algorithm: Euclidean</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-6 border-y border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Time</p>
                      <p className="text-sm font-semibold">{formatTime(selectedAlert.createdAt).split(',')[1]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Date</p>
                      <p className="text-sm font-semibold">{formatTime(selectedAlert.createdAt).split(',')[0]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Similarity</p>
                      <p className="text-sm font-semibold">{(100 - (selectedAlert.distance * 100)).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Action</p>
                      <p className={`text-sm font-semibold ${selectedAlert.reviewed ? 'text-green-600' : 'text-blue-600'}`}>
                        {selectedAlert.reviewed ? 'Reviewed' : 'Review Pending'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <button 
                    onClick={() => handleMarkAsReviewed(selectedAlert.id)}
                    disabled={selectedAlert.reviewed || isMarkingLoading}
                    className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                      selectedAlert.reviewed 
                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed border border-emerald-200' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 active:scale-95'
                    } ${isMarkingLoading ? 'opacity-70' : ''}`}
                  >
                    {isMarkingLoading ? (
                      <i className="fas fa-spinner animate-spin"></i>
                    ) : selectedAlert.reviewed ? (
                      <><i className="fas fa-check"></i> Already Reviewed</>
                    ) : (
                      'Mark as Reviewed'
                    )}
                  </button>
                  <button 
                    onClick={() => handleDownloadPDF(selectedAlert)}
                    disabled={isGeneratingPDF}
                    className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <i className="fas fa-file-pdf"></i>
                    {isGeneratingPDF ? 'Generating...' : 'Download Evidence'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
                <div className="mb-4">
                  <i className="fas fa-mouse-pointer text-4xl opacity-20"></i>
                </div>
                <p>Select an alert from the feed <br /> to see full details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Modal for Details */}
      {selectedAlert && (
        <div className="xl:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusBadge alert={selectedAlert} />
                <span className="font-bold">Security Alert Log</span>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="p-2 text-gray-400">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <img src={selectedAlert.imageUrl} className="w-full rounded-2xl shadow-lg border border-gray-100" />
              
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <img src={selectedAlert.croppedFaceUrl} className="w-20 h-20 rounded-xl object-cover border border-white shadow-sm" />
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Algorithm Result</p>
                  <h4 className="text-lg font-bold text-gray-900">
                    {selectedAlert.status === 'MATCH' ? selectedAlert.matchedWith : 'Unknown Person'}
                  </h4>
                  <p className="text-sm text-blue-600 font-medium mt-1">Match Confidence: {(100 - selectedAlert.distance * 100).toFixed(0)}%</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Timestamp</span>
                  <span className="font-semibold">{formatTime(selectedAlert.createdAt)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Camera</span>
                  <span className="font-semibold text-blue-600">Main Lobby - Cam 01</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedAlert.reviewed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {selectedAlert.reviewed ? 'REVIEWED' : 'PENDING'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 flex flex-col gap-3">
              <button 
                onClick={() => handleDownloadPDF(selectedAlert)}
                disabled={isGeneratingPDF}
                className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <i className="fas fa-file-pdf"></i>
                {isGeneratingPDF ? 'Downloading...' : 'Download PDF Evidence'}
              </button>
              <div className="flex gap-4">
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="flex-1 py-4 bg-white border border-gray-200 font-bold rounded-2xl text-gray-700 active:scale-95"
                >
                  Close
                </button>
                <button 
                  onClick={() => handleMarkAsReviewed(selectedAlert.id)}
                  disabled={selectedAlert.reviewed || isMarkingLoading}
                  className={`flex-1 py-4 font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                    selectedAlert.reviewed 
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 opacity-50 cursor-not-allowed' 
                      : 'bg-blue-600 text-white shadow-blue-500/30 active:scale-95'
                  }`}
                >
                  {isMarkingLoading ? (
                    <i className="fas fa-spinner animate-spin"></i>
                  ) : selectedAlert.reviewed ? (
                    'Reviewed'
                  ) : (
                    'Mark Review'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
