-- ============================================================
-- Shomvob (সম্ভব) — Sample Seed Data
-- Run AFTER schema.sql and rls_policies.sql
-- Used for development and testing only
-- ============================================================

-- Sample Jobs (no auth required for jobs table)
INSERT INTO jobs (title, company, location, is_remote, remote_type, experience_level, description, requirements, required_skills, apply_url, source, posted_date) VALUES

('Embedded Systems Engineer', 'Tesla', 'Fremont, CA', FALSE, 'onsite', 'mid',
 'Design and develop embedded software for vehicle control systems. Work with ARM Cortex-M processors and real-time operating systems.',
 'BS in EE/CS. 3+ years embedded C/C++. Experience with RTOS, CAN bus, SPI/I2C.',
 ARRAY['C', 'C++', 'RTOS', 'ARM', 'CAN Bus', 'SPI', 'I2C', 'Embedded Linux'],
 'https://boards.greenhouse.io/tesla/jobs/embedded-systems-001', 'greenhouse',
 NOW() - INTERVAL '2 days'),

('IoT Platform Engineer', 'Siemens', 'Remote', TRUE, 'remote', 'mid',
 'Build and maintain cloud-connected IoT platforms for industrial automation. Design MQTT-based data pipelines.',
 'Experience with MQTT, AWS IoT Core, Python. Understanding of industrial protocols.',
 ARRAY['Python', 'MQTT', 'AWS IoT', 'Docker', 'Kubernetes', 'PostgreSQL'],
 'https://jobs.lever.co/siemens/iot-platform-001', 'lever',
 NOW() - INTERVAL '1 day'),

('Computer Vision Engineer', 'Waymo', 'Mountain View, CA', FALSE, 'hybrid', 'senior',
 'Develop perception algorithms for autonomous vehicles. Train and deploy deep learning models for object detection and tracking.',
 'MS/PhD in CS or related. Strong PyTorch/TensorFlow experience. Published research preferred.',
 ARRAY['Python', 'PyTorch', 'TensorFlow', 'OpenCV', 'CUDA', 'C++', 'Computer Vision'],
 'https://boards.greenhouse.io/waymo/jobs/cv-engineer-001', 'greenhouse',
 NOW() - INTERVAL '3 days'),

('Firmware Developer', 'Qualcomm', 'San Diego, CA', FALSE, 'onsite', 'entry',
 'Develop firmware for wireless chipsets. Debug and optimize low-level drivers for Bluetooth and Wi-Fi.',
 'BS in EE/CS. Knowledge of C, assembly. Experience with oscilloscopes and logic analyzers.',
 ARRAY['C', 'Assembly', 'Bluetooth', 'Wi-Fi', 'JTAG', 'Firmware', 'Linux Kernel'],
 'https://jobs.lever.co/qualcomm/firmware-dev-001', 'lever',
 NOW() - INTERVAL '5 days'),

('Robotics Software Engineer', 'Boston Dynamics', 'Waltham, MA', FALSE, 'onsite', 'mid',
 'Build motion planning and control software for legged robots. Implement ROS2 nodes for perception and navigation.',
 '3+ years robotics experience. ROS2, C++, Python. Experience with kinematics and dynamics.',
 ARRAY['ROS2', 'C++', 'Python', 'Kinematics', 'SLAM', 'Motion Planning', 'Gazebo'],
 'https://boards.greenhouse.io/bostondynamics/jobs/robotics-001', 'greenhouse',
 NOW() - INTERVAL '1 day'),

('Edge AI Engineer', 'NVIDIA', 'Remote', TRUE, 'remote', 'mid',
 'Optimize deep learning models for edge deployment on Jetson platform. Build TensorRT and ONNX pipelines.',
 'Experience with model optimization, quantization, pruning. NVIDIA Jetson ecosystem.',
 ARRAY['Python', 'TensorRT', 'ONNX', 'CUDA', 'Jetson', 'Docker', 'Edge AI'],
 'https://remoteok.com/jobs/nvidia-edge-ai-001', 'remoteok',
 NOW() - INTERVAL '4 days'),

('Backend Engineer (Python)', 'Stripe', 'Remote', TRUE, 'remote', 'mid',
 'Design and build high-throughput payment processing APIs. Work with distributed systems at scale.',
 '3+ years Python. Experience with PostgreSQL, Redis, message queues. Strong system design skills.',
 ARRAY['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'System Design'],
 'https://boards.greenhouse.io/stripe/jobs/backend-001', 'greenhouse',
 NOW() - INTERVAL '2 days'),

('Full Stack Developer', 'Grab', 'Singapore', FALSE, 'hybrid', 'entry',
 'Build features across the Grab super-app. Work with React, Node.js, and Go microservices.',
 'BS in CS. Proficiency in JavaScript/TypeScript. REST API design experience.',
 ARRAY['TypeScript', 'React', 'Node.js', 'Go', 'PostgreSQL', 'Docker', 'GraphQL'],
 'https://jobs.lever.co/grab/fullstack-001', 'lever',
 NOW() - INTERVAL '6 days'),

('DevOps / Cloud Engineer', 'Datadog', 'Remote', TRUE, 'remote', 'mid',
 'Build and maintain CI/CD pipelines and cloud infrastructure. Manage Kubernetes clusters across multiple regions.',
 'Experience with AWS/GCP, Terraform, Kubernetes. Strong Linux skills.',
 ARRAY['AWS', 'Terraform', 'Kubernetes', 'Docker', 'Linux', 'Python', 'CI/CD'],
 'https://remoteok.com/jobs/datadog-devops-001', 'remoteok',
 NOW() - INTERVAL '3 days'),

('Cybersecurity Analyst', 'CrowdStrike', 'Remote', TRUE, 'remote', 'entry',
 'Monitor and respond to security incidents. Perform vulnerability assessments and penetration testing.',
 'Knowledge of network security, SIEM tools. Certifications preferred (CEH, CompTIA Security+).',
 ARRAY['SIEM', 'Penetration Testing', 'Network Security', 'Linux', 'Python', 'Wireshark'],
 'https://boards.greenhouse.io/crowdstrike/jobs/cybersecurity-001', 'greenhouse',
 NOW() - INTERVAL '7 days');

-- Classify the sample jobs
INSERT INTO job_categories (job_id, category, confidence)
SELECT j.id, c.category, c.confidence
FROM jobs j
CROSS JOIN LATERAL (
    VALUES
    ('embedded-systems-001', 'embedded', 0.95),
    ('embedded-systems-001', 'firmware', 0.70)
) AS c(url_suffix, category, confidence)
WHERE j.apply_url LIKE '%' || c.url_suffix || '%';

-- (In production, classification is done by the job_classifier service)
