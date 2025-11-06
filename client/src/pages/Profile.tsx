import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getBalance } from "../utils/solana";
import api from "../utils/api";

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  walletAddress: string;
  role: string;
  skills: string[];
  bio: string;
  rating: number;
  reviews: {
    from: {
      _id: string;
      username: string;
    };
    content: string;
    rating: number;
    createdAt: string;
  }[];
}

const Profile: React.FC = () => {
  const { publicKey, connected } = useWallet();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    bio: "",
    skills: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get("/api/users/profile");
        setProfile(response.data);

        // Set initial form data
        setFormData({
          username: response.data.username,
          email: response.data.email,
          bio: response.data.bio || "",
          skills: response.data.skills ? response.data.skills.join(", ") : "",
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Fetch wallet balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (connected && publicKey) {
        try {
          const solBalance = await getBalance(publicKey.toString());
          setBalance(solBalance);
        } catch (error) {
          console.error("Error fetching balance:", error);
        }
      }
    };

    fetchBalance();
  }, [connected, publicKey]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Prepare data for API
      const updateData = {
        username: formData.username,
        email: formData.email,
        bio: formData.bio,
        skills: formData.skills
          ? formData.skills.split(",").map((skill) => skill.trim())
          : [],
      };

      // Update profile
      const response = await api.put("/api/users/profile", updateData);

      // Update local state
      setProfile(response.data);
      setEditMode(false);

      // Update user info in localStorage
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      localStorage.setItem(
        "userInfo",
        JSON.stringify({
          ...userInfo,
          username: response.data.username,
          email: response.data.email,
        })
      );
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    }
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  if (error || !profile) {
    return (
      <div className="error-message">{error || "Failed to load profile"}</div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Your Profile</h1>

        {!connected && (
          <div className="wallet-connection">
            <p>Connect your wallet to view your balance</p>
            <WalletMultiButton />
          </div>
        )}
      </div>

      <div className="profile-container">
        <div className="profile-sidebar">
          <div className="wallet-section">
            <h2>Wallet Information</h2>

            <div className="wallet-address">
              <strong>Address:</strong>
              <span>
                {profile.walletAddress.slice(0, 8)}...
                {profile.walletAddress.slice(-8)}
              </span>
            </div>

            {connected && publicKey && (
              <div className="wallet-status">
                {publicKey.toString() === profile.walletAddress ? (
                  <span className="connected-status">✓ Wallet connected</span>
                ) : (
                  <span className="warning-status">
                    ⚠️ Connected wallet doesn't match profile
                  </span>
                )}
              </div>
            )}

            {balance !== null && (
              <div className="wallet-balance">
                <strong>Balance:</strong> {balance.toFixed(4)} SOL
              </div>
            )}
          </div>

          <div className="account-info">
            <h2>Account Type</h2>
            <div className="role-badge">
              {profile.role === "client" ? "Client" : "Freelancer"}
            </div>

            {profile.role === "freelancer" && (
              <div className="rating-section">
                <h3>Rating</h3>
                <div className="rating">
                  <span className="stars">
                    {"★".repeat(Math.round(profile.rating))}
                    {"☆".repeat(5 - Math.round(profile.rating))}
                  </span>
                  <span className="rating-value">
                    ({profile.rating.toFixed(1)})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="profile-main">
          {editMode ? (
            <form onSubmit={handleSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                />
              </div>

              {profile.role === "freelancer" && (
                <div className="form-group">
                  <label htmlFor="skills">Skills (comma-separated)</label>
                  <input
                    type="text"
                    id="skills"
                    name="skills"
                    value={formData.skills}
                    onChange={handleChange}
                  />
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="save-btn">
                  Save Changes
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setEditMode(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-details">
              <div className="profile-section">
                <h2>Personal Information</h2>
                <div className="info-group">
                  <span className="info-label">Username:</span>
                  <span className="info-value">{profile.username}</span>
                </div>
                <div className="info-group">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{profile.email}</span>
                </div>
                {profile.bio && (
                  <div className="info-group bio">
                    <span className="info-label">Bio:</span>
                    <p className="info-value">{profile.bio}</p>
                  </div>
                )}
              </div>

              {profile.role === "freelancer" && profile.skills.length > 0 && (
                <div className="profile-section">
                  <h2>Skills</h2>
                  <div className="skills-list">
                    {profile.skills.map((skill, index) => (
                      <span key={index} className="skill-tag">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setEditMode(true)}
                className="edit-profile-btn"
              >
                Edit Profile
              </button>
            </div>
          )}

          {/* Reviews section for freelancers */}
          {profile.role === "freelancer" && profile.reviews.length > 0 && (
            <div className="reviews-section">
              <h2>Reviews ({profile.reviews.length})</h2>
              <div className="reviews-list">
                {profile.reviews.map((review, index) => (
                  <div key={index} className="review-card">
                    <div className="review-header">
                      <span className="reviewer-name">
                        {review.from.username}
                      </span>
                      <span className="review-rating">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </span>
                    </div>
                    <p className="review-content">{review.content}</p>
                    <span className="review-date">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
