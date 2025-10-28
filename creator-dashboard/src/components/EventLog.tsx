import { useState, useEffect } from 'react';
import { useSDKContext } from '../contexts/SDKContext';
import type { ActivityItem } from '../types';

type EventType = 'all' | 'TileClaimed' | 'ItemPlaced' | 'ItemRemoved';

export default function EventLog() {
  const { sdk, isInitialized } = useSDKContext();
  
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType>('all');
  const [playerFilter, setPlayerFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (!sdk || !isInitialized) return;

    fetchEvents();

    const handleUpdate = () => {
      console.log('EventLog: Received update event, refetching...');
      fetchEvents();
    };

    sdk.on('tileClaimed', handleUpdate);
    sdk.on('itemPlaced', handleUpdate);
    sdk.on('itemRemoved', handleUpdate);
    sdk.on('worldUpdate', handleUpdate);

    return () => {
      sdk.off('tileClaimed', handleUpdate);
      sdk.off('itemPlaced', handleUpdate);
      sdk.off('itemRemoved', handleUpdate);
      sdk.off('worldUpdate', handleUpdate);
    };
  }, [sdk, isInitialized]);

  useEffect(() => {
    applyFilters();
  }, [events, eventTypeFilter, playerFilter, dateFromFilter, dateToFilter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/activity`);
      if (!response.ok) throw new Error('Failed to fetch activity');
      const data = await response.json();
      
      console.log('EventLog: Received data from API:', data);
      
      let activity: ActivityItem[] = [];
      if (Array.isArray(data)) {
        activity = data;
      } else if (data && Array.isArray(data.activity)) {
        activity = data.activity;
      } else if (data && Array.isArray(data.events)) {
        activity = data.events;
      } else {
        console.warn('EventLog: Unexpected data format, expected array but got:', typeof data);
      }
      
      console.log('EventLog: Processed activity array:', activity.length, 'events');
      
      setEvents(activity);
    } catch (err) {
      console.error('EventLog: Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
      setEvents([]);
      setFilteredEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const parseTimestamp = (timestamp: string | number): number => {
    if (!timestamp || timestamp === '0') return 0;
    
    try {
      if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) return date.getTime();
        
        const numTimestamp = Number(timestamp);
        if (!isNaN(numTimestamp)) {
          return numTimestamp < 10000000000 ? numTimestamp * 1000 : numTimestamp;
        }
      } else {
        return timestamp < 10000000000 ? timestamp * 1000 : timestamp;
      }
    } catch (err) {
      console.error('Error parsing timestamp:', timestamp, err);
    }
    return 0;
  };

  const applyFilters = () => {
    if (!Array.isArray(events)) {
      setFilteredEvents([]);
      return;
    }
    
    let filtered = [...events];

    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(e => e.eventType === eventTypeFilter);
    }

    if (playerFilter.trim()) {
      const searchTerm = playerFilter.toLowerCase();
      filtered = filtered.filter(e => 
        e.playerAddress.toLowerCase().includes(searchTerm)
      );
    }

    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter).getTime();
      filtered = filtered.filter(e => parseTimestamp(e.timestamp) >= fromDate);
    }

    if (dateToFilter) {
      const toDate = new Date(dateToFilter).getTime() + 86400000;
      filtered = filtered.filter(e => parseTimestamp(e.timestamp) < toDate);
    }

    setFilteredEvents(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setEventTypeFilter('all');
    setPlayerFilter('');
    setDateFromFilter('');
    setDateToFilter('');
  };

  const hasActiveFilters = 
    eventTypeFilter !== 'all' || 
    playerFilter.trim() !== '' || 
    dateFromFilter !== '' || 
    dateToFilter !== '';

  const totalPages = Math.ceil((filteredEvents?.length || 0) / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedEvents = (filteredEvents || []).slice(startIndex, endIndex);

  const formatTimestamp = (timestamp: string | number) => {
    if (!timestamp || timestamp === '0') return 'N/A';
    
    try {
      let date: Date;
      
      if (typeof timestamp === 'string') {
        date = new Date(timestamp);
        
        if (isNaN(date.getTime())) {
          const numTimestamp = Number(timestamp);
          if (!isNaN(numTimestamp)) {
            date = new Date(numTimestamp < 10000000000 ? numTimestamp * 1000 : numTimestamp);
          } else {
            return 'Invalid Date';
          }
        }
      } else {
        date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
      }
      
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (err) {
      console.error('Error formatting timestamp:', timestamp, err);
      return 'Invalid Date';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'TileClaimed':
        return '🎯';
      case 'ItemPlaced':
        return '📦';
      case 'ItemRemoved':
        return '🗑️';
      default:
        return '📝';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'TileClaimed':
        return 'text-blue-400';
      case 'ItemPlaced':
        return 'text-green-400';
      case 'ItemRemoved':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-6">Event Log</h2>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-6">Event Log</h2>
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">Error loading events: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Event Log</h2>
        <div className="text-sm text-slate-400">
          {filteredEvents?.length || 0} {(filteredEvents?.length || 0) === 1 ? 'event' : 'events'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Event Type
          </label>
          <select
            title="Event Type"
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value as EventType)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Events</option>
            <option value="TileClaimed">Tile Claimed</option>
            <option value="ItemPlaced">Item Placed</option>
            <option value="ItemRemoved">Item Removed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Player Address
          </label>
          <input
            type="text"
            value={playerFilter}
            onChange={(e) => setPlayerFilter(e.target.value)}
            placeholder="0x... or partial"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            From Date
          </label>
          <input
            title="From Date"
            type="date"
            value={dateFromFilter}
            onChange={(e) => setDateFromFilter(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            To Date
          </label>
          <input
            title="To Date"
            type="date"
            value={dateToFilter}
            onChange={(e) => setDateToFilter(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mb-4">
          <button
            onClick={clearFilters}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Event</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Player</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Tile</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Details</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Time</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvents.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <div className="text-slate-400">
                    {hasActiveFilters ? 'No events match your filters' : 'No events yet'}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedEvents.map((event, index) => (
                <tr 
                  key={`${event.transactionHash}-${index}`}
                  className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getEventIcon(event.eventType)}</span>
                      <span className={`text-sm font-medium ${getEventColor(event.eventType)}`}>
                        {event.eventType.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-sm text-slate-300 bg-slate-900/50 px-2 py-1 rounded">
                      {formatAddress(event.playerAddress)}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-white font-mono">
                      {event.tileId}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {event.eventType === 'TileClaimed' ? (
                      <span className="text-sm text-slate-500 italic">Ownership claimed</span>
                    ) : event.eventType === 'ItemRemoved' ? (
                      <span className="text-sm text-slate-500 italic">Item removed</span>
                    ) : event.itemType !== undefined ? (
                      <span className="text-sm text-slate-300">
                        {event.itemType === 0 ? 'Empty' : 
                         event.itemType === 1 ? '🌲 Tree' :
                         event.itemType === 2 ? '🪨 Rock' :
                         event.itemType === 3 ? '🚩 Flag' :
                         event.itemType === 4 ? '🏢 Building' :
                         event.itemType === 5 ? '💧 Water' : 'Unknown'}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-slate-400">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Show:</label>
            <select
              title="Events per page"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span className="text-sm text-slate-400">per page</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className="text-sm text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}