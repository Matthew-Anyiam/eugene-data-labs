from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="eugene-intelligence",
    version="0.1.0",
    author="Matthew Anyiam",
    author_email="matthew@eugeneintelligence.com",
    description="Data Infrastructure for AI Agents — SEC, FRED, FMP",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Matthew-Anyiam/eugene-data-labs",
    packages=find_packages(exclude=["tests", "api", "venv"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
    ],
    python_requires=">=3.10",
    install_requires=[
        "requests>=2.28.0",
        "feedparser>=6.0.0",
    ],
    license="MIT",
)
