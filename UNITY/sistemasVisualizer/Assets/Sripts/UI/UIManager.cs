using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TMPro;

//Manage the main menu UI interactions and connection status by events
public class UIManager : MonoBehaviour
{
    [SerializeField] private GameObject mainMenuPanel;
    [SerializeField] private GameObject connectionPanel;
    [SerializeField] private TextMeshProUGUI statusText;

    [SerializeField] private Button connectButton;
    [SerializeField] private Button roomListButton;
    [SerializeField] private Button replayListButton;
    [SerializeField] private Button quitButton;

    private volatile bool _pendingShowMainMenu;
    private volatile bool _pendingDisconnected;

    private void Start()
    {
        connectButton?.onClick.AddListener(OnConnectClicked);
        roomListButton?.onClick.AddListener(OnRoomListClicked);
        replayListButton?.onClick.AddListener(OnReplayListClicked);
        quitButton?.onClick.AddListener(OnQuitClicked);

        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnConnected += OnConnected;
            SocketManager.Instance.OnDisconnected += OnDisconnected;
        }

        ShowMainMenu();
    }

    private void Update()
    {
        if (_pendingShowMainMenu)
        {
            _pendingShowMainMenu = false;

            if (statusText != null)
                statusText.text = "Connected!";

            ShowMainMenu();
        }

        if (_pendingDisconnected)
        {
            _pendingDisconnected = false;

            if (statusText != null)
                statusText.text = "Disconnected from server";
        }
    }

    private void OnConnectClicked()
    {
        if (connectionPanel != null) connectionPanel.SetActive(true);
        if (mainMenuPanel != null) mainMenuPanel.SetActive(false);
        if (statusText != null) statusText.text = "Connecting...";

        SocketManager.Instance.Connect();
    }

    private void OnConnected()
    {
        _pendingShowMainMenu = true;
    }

    private void OnDisconnected()
    {
        _pendingDisconnected = true;
    }

    private void ShowMainMenu()
    {
        if (mainMenuPanel != null) mainMenuPanel.SetActive(true);
        if (connectionPanel != null) connectionPanel.SetActive(false);
    }

    private void OnRoomListClicked()
    {
        if (SocketManager.Instance.socket != null && SocketManager.Instance.socket.Connected)
        {
            SceneManager.LoadScene("RoomList");
        }
        else if (statusText != null)
        {
            statusText.text = "Please connect first!";
        }
    }

    private void OnReplayListClicked()
    {
        if (SocketManager.Instance.socket != null && SocketManager.Instance.socket.Connected)
        {
            SceneManager.LoadScene("ReplayList");
        }
        else if (statusText != null)
        {
            statusText.text = "Please connect first!";
        }
    }

    private void OnQuitClicked()
    {
        Application.Quit();
    }

    private void OnDestroy()
    {
        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnConnected -= OnConnected;
            SocketManager.Instance.OnDisconnected -= OnDisconnected;
        }
    }
}