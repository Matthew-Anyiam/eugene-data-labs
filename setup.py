from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="eugene-data-labs",
    version="0.1.0",
    author="Rex Yang",
    author_email="rex@eugeneintelligence.com",
    description="The most accurate market and financial data for agents — to reason, extract, and act",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/rexyang624/eugene-data-labs",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Intended Audience :: Financial and Insurance Industry",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Office/Business :: Financial",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.10",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "eugene=eugene_cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "": ["*.md", "*.json", "*.html"],
    },
)
