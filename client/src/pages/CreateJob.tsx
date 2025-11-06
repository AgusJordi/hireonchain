import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import api from "../utils/api";

const CreateJob: React.FC = () => {
  const navigate = useNavigate();
  const { publicKey, connected } = useWallet();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    skills: "",
    deadline: "",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [userRole, setUserRole] = useState("");

  // Check user role
  useEffect(() => {
    const userInfoStr = localStorage.getItem("userInfo");
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      setUserRole(userInfo.role);

      // Redirect if not a client
      if (userInfo.role !== "client") {
        alert("Only clients can post jobs");
        navigate("/dashboard");
      }
    }
  }, [navigate]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!formData.price) {
      newErrors.price = "Price is required";
    } else if (parseFloat(formData.price) <= 0) {
      newErrors.price = "Price must be greater than 0";
    }

    if (!formData.skills.trim()) {
      newErrors.skills = "At least one skill is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !publicKey) {
      setSubmitError("Please connect your wallet first");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      // Format data for API
      const jobData = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        skills: formData.skills.split(",").map((skill) => skill.trim()),
        deadline: formData.deadline
          ? new Date(formData.deadline).toISOString()
          : null,
      };

      const response = await api.post("/api/jobs", jobData);

      navigate(`/jobs/${response.data._id}`);
    } catch (error) {
      console.error("Error creating job:", error);
      if (error instanceof Error) {
        setSubmitError(
          error.message || "Failed to create job. Please try again."
        );
      } else {
        setSubmitError("Failed to create job. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userRole !== "client") {
    return null; // Prevent rendering until redirect happens
  }

  return (
    <div className="create-job-page">
      <h1>Post a New Job</h1>

      {!connected ? (
        <div className="wallet-connection">
          <p>Please connect your wallet to post a job</p>
          <WalletMultiButton />
        </div>
      ) : (
        <div className="job-form-container">
          {submitError && <div className="error-message">{submitError}</div>}

          <form onSubmit={handleSubmit} className="job-form">
            <div className="form-group">
              <label htmlFor="title">Job Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="E.g. Develop a DeFi App on Solana"
              />
              {errors.title && <div className="error">{errors.title}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="description">Job Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Provide a detailed description of the job requirements..."
                rows={6}
              />
              {errors.description && (
                <div className="error">{errors.description}</div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="price">Budget (SOL)</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="Enter amount in SOL"
                step="0.01"
                min="0"
              />
              {errors.price && <div className="error">{errors.price}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="skills">Required Skills (comma-separated)</label>
              <input
                type="text"
                id="skills"
                name="skills"
                value={formData.skills}
                onChange={handleChange}
                placeholder="E.g. React, Solana, Rust"
              />
              {errors.skills && <div className="error">{errors.skills}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="deadline">Deadline (optional)</label>
              <input
                type="date"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                min={new Date().toISOString().split("T")[0]}
              />
              {errors.deadline && (
                <div className="error">{errors.deadline}</div>
              )}
            </div>

            <div className="wallet-info">
              <p>
                <strong>Connected Wallet:</strong>{" "}
                {publicKey
                  ? `${publicKey.toString().slice(0, 6)}...${publicKey
                      .toString()
                      .slice(-4)}`
                  : ""}
              </p>
              <p className="wallet-note">
                This wallet will be associated with your job posting.
              </p>
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating Job..." : "Post Job"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default CreateJob;
