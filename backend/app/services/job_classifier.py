"""
Shomvob (সম্ভব) — Job Classification Service.

Uses keyword-based rules to classify job postings into 15 specific categories.
"""

from __future__ import annotations

import re

# Precise keyword mappings for engineering domains
CATEGORY_KEYWORDS = {
    "iot": [
        "iot",
        "internet of things",
        "mqtt",
        "zigbee",
        "lora",
        "lorawan",
        "smart home",
        "coap",
        "modbus",
        "telemetry",
        "rf",
        "bluetooth",
        "ble",
    ],
    "embedded": [
        "embedded",
        "microcontroller",
        "stm32",
        "arm",
        "mips",
        "rtos",
        "bare metal",
        "baremetal",
        "gpio",
        "i2c",
        "spi",
        "uart",
        "hardware abstraction",
        "hal",
        "esp32",
        "arduino",
        "pic",
        "avr",
    ],
    "firmware": [
        "firmware",
        "bootloader",
        "driver development",
        "device driver",
        "jtag",
        "hardware register",
        "low level",
        "low-level c",
        "sdk",
        "flashing",
        "eeprom",
        "nand",
        "nor flash",
    ],
    "robotics": [
        "robot",
        "robotics",
        "ros",
        "ros2",
        "kinematics",
        "actuator",
        "slam",
        "motion planning",
        "autonomous mobile robot",
        "amr",
        "gazebo",
        "lidar",
        "imu",
        "odometry",
        "servo",
        "trajectory",
    ],
    "ai": [
        "artificial intelligence",
        "neural network",
        "transformer",
        "llm",
        "gpt",
        "rag",
        "openai",
        "generative ai",
        "langchain",
        "llamaindex",
        "prompt engineering",
        "agentic",
        "multi-agent",
    ],
    "ml": [
        "machine learning",
        "sklearn",
        "scikit",
        "xgboost",
        "random forest",
        "regression",
        "supervised learning",
        "unsupervised learning",
        "pandas",
        "numpy",
        "jupyter",
        "feature engineering",
        "model training",
    ],
    "deep_learning": [
        "deep learning",
        "pytorch",
        "tensorflow",
        "keras",
        "cnn",
        "rnn",
        "lstm",
        "backpropagation",
        "autoencoder",
        "gan",
        "diffusion model",
        "weights and biases",
        "cuda",
        "tensorrt",
    ],
    "computer_vision": [
        "computer vision",
        "opencv",
        "yolo",
        "image recognition",
        "object detection",
        "segmentation",
        "ocr",
        "image processing",
        "pose estimation",
        "facial recognition",
        "depth sensing",
        "point cloud",
    ],
    "edge_ai": [
        "edge ai",
        "tinyml",
        "edge computing",
        "on-device",
        "coral",
        "tflite",
        "jetson nano",
        "quantization",
        "model pruning",
        "embedded ai",
        "npu",
        "edge tpu",
    ],
    "backend": [
        "backend",
        "api",
        "rest",
        "graphql",
        "django",
        "fastapi",
        "flask",
        "express",
        "node.js",
        "spring boot",
        "laravel",
        "postgres",
        "postgresql",
        "mysql",
        "redis",
        "microservices",
    ],
    "full_stack": [
        "full stack",
        "fullstack",
        "frontend",
        "react",
        "next.js",
        "vue",
        "angular",
        "typescript",
        "svelte",
        "tailwind",
        "css",
        "html",
        "responsive design",
        "user interface",
        "ui/ux",
    ],
    "devops": [
        "devops",
        "ci/cd",
        "github actions",
        "gitlab ci",
        "jenkins",
        "terraform",
        "ansible",
        "kubernetes",
        "k8s",
        "docker",
        "containerization",
        "prometheus",
        "grafana",
    ],
    "cloud": [
        "aws",
        "azure",
        "gcp",
        "cloud",
        "serverless",
        "lambda",
        "s3",
        "ec2",
        "dynamodb",
        "cloud computing",
        "iam",
        "virtual private cloud",
    ],
    "cybersecurity": [
        "security",
        "cybersecurity",
        "penetration",
        "vulnerability",
        "soc",
        "siem",
        "firewall",
        "cryptography",
        "owasp",
        "malware",
        "threat intelligence",
        "reverse engineering",
        "wireshark",
    ],
    "data_engineering": [
        "data engineer",
        "data engineering",
        "etl",
        "airflow",
        "spark",
        "kafka",
        "data pipeline",
        "data warehouse",
        "snowflake",
        "bigquery",
        "hadoop",
        "dbt",
    ],
    "government": [
        "government",
        "govt",
        "bpsc",
        "bcs",
        "teletalk",
        "ministry",
        "circular",
        "public sector",
        "সার্কুলার",
        "নিয়োগ",
        "প্রকৌশলী",
        "সহকারী প্রকৌশলী",
        "উপ-সহকারী প্রকৌশলী",
        "সহকারী প্রোগ্রামার",
        "পাবলিক সার্ভিস",
        "বাংলাদেশ",
        "মন্ত্রণালয়",
        "অধিদপ্তর",
        "কমিশন",
        "কর্তৃপক্ষ",
        "বোর্ড",
        "ব্যাংক",
        "কর্মকর্তা",
        "অফিসার",
        "ক্যাডার",
        "নন-ক্যাডার",
        "সহকারী পরিচালক",
        "প্রভাষক",
        "বিশ্ববিদ্যালয়",
        "সেনাবাহিনী",
        "বিমানবাহিনী",
        "নৌবাহিনী",
        "পুলিশ",
        "বিভাগীয় কমিশনার",
        "জেলা প্রশাসক",
        "সেতু কর্তৃপক্ষ",
        "পল্লী বিদ্যুৎ",
        "প্রাণিসম্পদ",
    ],
}


def classify_job(
    title: str, description: str, skills: list[str] | None = None
) -> list[tuple[str, float]]:
    """
    Classify a job posting based on keywords found in the title, description, and skills.

    Args:
        title: The job title.
        description: The job description.
        skills: Predefined skills from the job posting, if any.

    Returns:
        A list of (category_name, confidence) sorted by confidence in descending order.
    """
    skill_list = skills or []
    text_to_search = f"{title} {description} {' '.join(skill_list)}".lower()

    # Clean text to avoid partial word matches causing false positives
    text_to_search = re.sub(r"[^\w\s\-]", " ", text_to_search)

    matches: list[tuple[str, float]] = []

    for category, keywords in CATEGORY_KEYWORDS.items():
        hits = 0
        weight_boost = 0.0

        # Scan keywords
        for keyword in keywords:
            # AMR note: some keywords like "amr" may appear with punctuation or adjacent chars.
            # Use a more tolerant boundary: either start/end or non-word char around the token.
            pattern = rf"(?:^|[^\\w]){re.escape(keyword)}(?:$|[^\\w])"
            matches_found = re.findall(pattern, text_to_search)
            if matches_found:
                hits += len(matches_found)
                # Boost confidence if the keyword is directly in the job title
                if keyword in title.lower():
                    weight_boost += 0.25

        if hits > 0:
            # Heuristic calculation for confidence:
            # Base confidence scales with unique keyword hits. Max base confidence is 0.8
            base_confidence = min(hits * 0.15, 0.80)
            confidence = min(base_confidence + weight_boost, 1.0)
            matches.append((category, round(confidence, 2)))

    # Sort by confidence descending
    return sorted(matches, key=lambda x: x[1], reverse=True)
