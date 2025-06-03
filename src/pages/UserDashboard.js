import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import bookingService from '../services/bookingService';
import LoadingSpinner from '../components/LoadingSpinner';
import './UserDashboard.css';

const DEFAULT_PROFILE_IMAGE = "https://via.placeholder.com/150";

const UserDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    height: '',
    weight: '',
    healthGoals: '',
    dietaryRestrictions: '',
    allergies: ''
  });

  useEffect(() => {
    // Check authentication
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        // Fetch user data
        fetchUserData(user.uid);
        // Fetch user bookings
        fetchUserBookings(user.uid);
      } else {
        navigate('/auth');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);
  
  // Refresh bookings whenever the component mounts or when returning to this page 
  // or when lastRefresh changes
  useEffect(() => {
    if (currentUser && currentUser.uid) {
      // Check if we need to refresh bookings based on navigation state
      if (location.state && location.state.refreshBookings) {
        // Clear the state so future navigations don't trigger refresh unnecessarily
        navigate(location.pathname, { replace: true, state: {} });
        fetchUserBookings(currentUser.uid);
      } else {
        fetchUserBookings(currentUser.uid);
      }
    }
  }, [location.key, lastRefresh]);

  const fetchUserData = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnapshot = await getDoc(userRef);
      
      if (userSnapshot.exists()) {
        const data = userSnapshot.data();
        
        // Check if user is an expert - if so, redirect to expert dashboard
        if (data.userType === 'expert') {
          navigate('/expert-dashboard');
          return;
        }
        
        setUserData(data);
        // Initialize form data with user data
        setFormData({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
          dateOfBirth: data.dateOfBirth || '',
          gender: data.gender || '',
          height: data.height || '',
          weight: data.weight || '',
          healthGoals: data.healthGoals || '',
          dietaryRestrictions: data.dietaryRestrictions || '',
          allergies: data.allergies || ''
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBookings = async (userId) => {
    try {
      setLoadingBookings(true);
      const userBookings = await bookingService.getUserBookings(userId);
      setBookings(userBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Failed to load your bookings. Please try again.');
    } finally {
      setLoadingBookings(false);
    }
  };

  // Function to manually refresh bookings
  const refreshBookings = () => {
    if (currentUser && currentUser.uid) {
      setLastRefresh(Date.now());
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await bookingService.cancelBooking(bookingId);
      // Update bookings state
      setBookings(prevBookings => 
        prevBookings.map(booking => 
          booking.id === bookingId 
            ? { ...booking, status: 'cancelled' } 
            : booking
        )
      );
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setError('Failed to cancel booking. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to log out. Please try again.');
    }
  };

  // Helper function to format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form data to current user data
    if (userData) {
      setFormData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phone: userData.phone || '',
        dateOfBirth: userData.dateOfBirth || '',
        gender: userData.gender || '',
        height: userData.height || '',
        weight: userData.weight || '',
        healthGoals: userData.healthGoals || '',
        dietaryRestrictions: userData.dietaryRestrictions || '',
        allergies: userData.allergies || ''
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    try {
      setIsSaving(true);
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, formData);
      
      // Update local state
      setUserData(prev => ({
        ...prev,
        ...formData
      }));
      
      setIsEditing(false);
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ text: 'Failed to update profile. Please try again.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading..." />;
  }

  return (
    <div className="user-dashboard">
      <div className="dashboard-header">
        <h1>User Dashboard</h1>
        <button className="logout-button" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt"></i>
          Logout
        </button>
      </div>
      
      {message.text && (
        <div className={`dashboard-message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <div className="dashboard-content">
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-image">
              <img src={DEFAULT_PROFILE_IMAGE} alt="Profile" />
            </div>
            <div className="profile-info">
              <h2>{userData?.firstName ? `${userData.firstName} ${userData.lastName}` : currentUser?.email}</h2>
              <p className="email">{currentUser?.email}</p>
            </div>
          </div>

          {!isEditing ? (
            <>
              <button className="edit-profile-button" onClick={handleEditProfile}>
                <i className="fas fa-edit"></i>
                Edit Profile
              </button>
              
              <div className="profile-details">
                <div className="profile-section">
                  <h3>Personal Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>First Name:</label>
                      <span>{userData?.firstName || currentUser?.displayName?.split(' ')[0] || 'Not provided'}</span>
                    </div>
                    <div className="info-item">
                      <label>Last Name:</label>
                      <span>{userData?.lastName || currentUser?.displayName?.split(' ')[1] || 'Not provided'}</span>
                    </div>
                    <div className="info-item">
                      <label>Email:</label>
                      <span>{currentUser?.email || 'Not provided'}</span>
                    </div>
                    <div className="info-item">
                      <label>Phone:</label>
                      <span>{userData?.phone || 'Not provided'}</span>
                    </div>
                    <div className="info-item">
                      <label>Date of Birth:</label>
                      <span>{userData?.dateOfBirth || 'Not provided'}</span>
                    </div>
                    <div className="info-item">
                      <label>Gender:</label>
                      <span>{userData?.gender || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                <div className="profile-section">
                  <h3>Health Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Height:</label>
                      <span>{userData?.height || 'Not provided'}</span>
                    </div>
                    <div className="info-item">
                      <label>Weight:</label>
                      <span>{userData?.weight || 'Not provided'}</span>
                    </div>
                  </div>
                  <div className="info-item full-width">
                    <label>Health Goals:</label>
                    <p>{userData?.healthGoals || 'Not provided'}</p>
                  </div>
                  <div className="info-item full-width">
                    <label>Dietary Restrictions:</label>
                    <p>{userData?.dietaryRestrictions || 'Not provided'}</p>
                  </div>
                  <div className="info-item full-width">
                    <label>Allergies:</label>
                    <p>{userData?.allergies || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="edit-profile-form">
              <div className="form-section">
                <h3>Personal Information</h3>
                <div className="form-grid">
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        value={currentUser?.email || ''}
                        disabled
                        className="disabled-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleInputChange}>
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Health Information</h3>
                <div className="form-grid">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Height (cm)</label>
                      <input
                        type="number"
                        name="height"
                        value={formData.height}
                        onChange={handleInputChange}
                        placeholder="Enter height in cm"
                      />
                    </div>
                    <div className="form-group">
                      <label>Weight (kg)</label>
                      <input
                        type="number"
                        name="weight"
                        value={formData.weight}
                        onChange={handleInputChange}
                        placeholder="Enter weight in kg"
                      />
                    </div>
                  </div>
                  <div className="form-group full-width">
                    <label>Health Goals</label>
                    <textarea
                      name="healthGoals"
                      value={formData.healthGoals}
                      onChange={handleInputChange}
                      placeholder="Describe your health goals"
                      rows="3"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Dietary Restrictions</label>
                    <textarea
                      name="dietaryRestrictions"
                      value={formData.dietaryRestrictions}
                      onChange={handleInputChange}
                      placeholder="List any dietary restrictions"
                      rows="3"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Allergies</label>
                    <textarea
                      name="allergies"
                      value={formData.allergies}
                      onChange={handleInputChange}
                      placeholder="List any allergies"
                      rows="3"
                    />
                  </div>
                </div>
              </div>

              <div className="edit-actions">
                <button className="cancel-button" onClick={handleCancelEdit}>
                  Cancel
                </button>
                <button 
                  className="save-button" 
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-section">
          <h3>Find Nutrition Experts</h3>
          <p>Connect with qualified nutrition experts to get personalized advice.</p>
          <button 
            className="action-button"
            onClick={() => navigate('/experts')}
          >
            Browse Experts
          </button>
        </div>
        
        <div className="dashboard-section appointments-section">
          <div className="section-header">
          <h3>My Appointments</h3>
            <button 
              className="refresh-button" 
              onClick={refreshBookings}
              disabled={loadingBookings}
            >
              {loadingBookings ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          {loadingBookings ? (
            <div className="loading-bookings">Loading your appointments...</div>
          ) : bookings.length === 0 ? (
            <div className="empty-state">
              <p className="no-appointments">You don't have any upcoming appointments.</p>
              <button 
                className="action-button"
                onClick={() => navigate('/experts')}
              >
                Book an Appointment
              </button>
            </div>
          ) : (
            <>
              <div className="bookings-container">
                <div className="bookings-group">
                  <h4>Pending Confirmations</h4>
                  {bookings.filter(b => b.status === 'pending').length > 0 ? (
                    <div className="bookings-cards">
                      {bookings
                        .filter(booking => booking.status === 'pending')
                        .map(booking => (
                          <div key={booking.id} className="booking-card pending">
                            <div className="booking-header">
                              <h5>Appointment with {booking.expertName}</h5>
                              <span className="booking-status">Awaiting Confirmation</span>
                            </div>
                            <div className="booking-details">
                              <p><strong>Time:</strong> {booking.slotTime}</p>
                              <p><strong>Requested:</strong> {formatDate(booking.createdAt)}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="empty-message">No pending appointments</p>
                  )}
                </div>

                <div className="bookings-group">
                  <h4>Upcoming Appointments</h4>
                  {bookings.filter(b => b.status === 'confirmed').length > 0 ? (
                    <div className="bookings-cards">
                      {bookings
                        .filter(booking => booking.status === 'confirmed')
                        .map(booking => (
                          <div key={booking.id} className="booking-card confirmed">
                            <div className="booking-header">
                              <h5>Appointment with {booking.expertName}</h5>
                              <span className="booking-status">Confirmed</span>
                            </div>
                            <div className="booking-details">
                              <p><strong>Time:</strong> {booking.slotTime}</p>
                              <p><strong>Confirmed:</strong> {formatDate(booking.updatedAt)}</p>
                              {booking.meetingLink && (
                                <a 
                                  href={booking.meetingLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="meeting-link"
                                >
                                  Join Meeting
                                </a>
                              )}
                              <button 
                                className="cancel-button"
                                onClick={() => handleCancelBooking(booking.id)}
                              >
                                Cancel Appointment
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="empty-message">No confirmed appointments</p>
                  )}
                </div>

                {bookings.filter(b => b.status === 'rejected' || b.status === 'cancelled').length > 0 && (
                  <div className="bookings-group">
                    <h4>Past & Cancelled Appointments</h4>
                    <div className="bookings-cards">
                      {bookings
                        .filter(booking => booking.status === 'rejected' || booking.status === 'cancelled')
                        .map(booking => (
                          <div key={booking.id} className={`booking-card ${booking.status}`}>
                            <div className="booking-header">
                              <h5>Appointment with {booking.expertName}</h5>
                              <span className="booking-status">
                                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </span>
                            </div>
                            <div className="booking-details">
                              <p><strong>Time:</strong> {booking.slotTime}</p>
                              {booking.rejectionReason && (
                                <p><strong>Reason:</strong> {booking.rejectionReason}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="booking-cta">
                <button 
                  className="action-button"
                  onClick={() => navigate('/experts')}
                >
                  Book New Appointment
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard; 