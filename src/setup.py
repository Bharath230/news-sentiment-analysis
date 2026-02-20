import pandas as pd
import sklearn
import transformers
import torch
import flask
import spacy
import nltk
nltk.download('punkt')
nltk.download('stopwords')
import torch
print("CUDA available:", torch.cuda.is_available())
print("Device:", torch.device("cuda" if torch.cuda.is_available() else "cpu"))
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))