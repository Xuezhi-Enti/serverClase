using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TMPro;

public class ReplayViewer : MonoBehaviour
{
    [SerializeField] private NodeGrid nodeGrid;
    [SerializeField] private Button playPauseButton;
    [SerializeField] private Button stopButton;
    [SerializeField] private Button backButton;
    [SerializeField] private Slider timelineSlider;
    [SerializeField] private TextMeshProUGUI timeText;
    [SerializeField] private float playbackSpeed = 1f;
    
    private SocketManager.ReplayData currentReplay;
    private bool isPlaying = false;
    private int currentFrameIndex = 0;
    private Coroutine playbackCoroutine;
    
    private void Start()
    {
        // Subscribe to replay data event
        SocketManager.Instance.OnReplayDataReceived += OnReplayDataReceived;
        
        // Setup buttons
        playPauseButton?.onClick.AddListener(TogglePlayPause);
        stopButton?.onClick.AddListener(StopReplay);
        backButton?.onClick.AddListener(GoBack);
        
        // Setup timeline slider
        if (timelineSlider != null)
        {
            timelineSlider.onValueChanged.AddListener(OnTimelineChanged);
        }
    }
    
    private void OnReplayDataReceived(SocketManager.ReplayData replayData)
    {
        currentReplay = replayData;
        
        if (currentReplay.frames.Count > 0)
        {
            // Setup grid with first frame
            var firstFrame = currentReplay.frames[0];
            if (firstFrame.gridUpdate != null)
            {
                Debug.Log("Replay loaded with " + currentReplay.frames.Count + " frames");
            }
            
            // Setup timeline
            if (timelineSlider != null)
            {
                timelineSlider.maxValue = currentReplay.frames.Count - 1;
                timelineSlider.value = 0;
            }
        }
    }
    
    private void TogglePlayPause()
    {
        if (isPlaying)
        {
            PauseReplay();
        }
        else
        {
            PlayReplay();
        }
    }
    
    private void PlayReplay()
    {
        if (currentReplay == null || currentReplay.frames.Count == 0)
        {
            Debug.LogWarning("No replay data loaded!");
            return;
        }
        
        isPlaying = true;
        if (playbackCoroutine != null)
        {
            StopCoroutine(playbackCoroutine);
        }
        playbackCoroutine = StartCoroutine(PlaybackCoroutine());
        
        if (playPauseButton != null)
        {
            playPauseButton.GetComponentInChildren<TextMeshProUGUI>().text = "Pause";
        }
    }
    
    private void PauseReplay()
    {
        isPlaying = false;
        if (playbackCoroutine != null)
        {
            StopCoroutine(playbackCoroutine);
        }
        
        if (playPauseButton != null)
        {
            playPauseButton.GetComponentInChildren<TextMeshProUGUI>().text = "Play";
        }
    }
    
    private void StopReplay()
    {
        PauseReplay();
        currentFrameIndex = 0;
        if (timelineSlider != null)
        {
            timelineSlider.value = 0;
        }
    }
    
    private IEnumerator PlaybackCoroutine()
    {
        while (currentFrameIndex < currentReplay.frames.Count && isPlaying)
        {
            var frame = currentReplay.frames[currentFrameIndex];
            
            // Apply frame
            if (frame.gridUpdate != null)
            {
                nodeGrid.UpdateGrid(frame.gridUpdate);
            }
            
            // Update UI
            if (timelineSlider != null)
            {
                timelineSlider.value = currentFrameIndex;
            }
            
            if (timeText != null)
            {
                timeText.text = $"Frame: {currentFrameIndex + 1}/{currentReplay.frames.Count}";
            }
            
            currentFrameIndex++;
            
            // Wait based on timestamp or fixed delay
            float waitTime = 0.1f / playbackSpeed;
            if (currentFrameIndex < currentReplay.frames.Count)
            {
                float nextTimestamp = currentReplay.frames[currentFrameIndex].timestamp;
                float currentTimestamp = frame.timestamp;
                waitTime = (nextTimestamp - currentTimestamp) / playbackSpeed;
            }
            
            yield return new WaitForSeconds(waitTime);
        }
        
        // Replay finished
        isPlaying = false;
        if (playPauseButton != null)
        {
            playPauseButton.GetComponentInChildren<TextMeshProUGUI>().text = "Play";
        }
    }
    
    private void OnTimelineChanged(float value)
    {
        if (!isPlaying && currentReplay != null)
        {
            currentFrameIndex = Mathf.RoundToInt(value);
            if (currentFrameIndex < currentReplay.frames.Count)
            {
                var frame = currentReplay.frames[currentFrameIndex];
                if (frame.gridUpdate != null)
                {
                    nodeGrid.UpdateGrid(frame.gridUpdate);
                }
            }
        }
    }
    
    private void GoBack()
    {
        SceneManager.LoadScene("MainMenu");
    }
    
    private void OnDestroy()
    {
        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnReplayDataReceived -= OnReplayDataReceived;
        }
    }
}